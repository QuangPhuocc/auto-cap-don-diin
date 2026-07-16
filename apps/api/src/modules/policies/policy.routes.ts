import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import { JobType, UserRole, Prisma, PolicyStatus } from "@prisma/client";
import xlsx from "xlsx";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { audit } from "../../lib/audit.js";
import { AppError, assertFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { ocrUpload } from "../../middleware/upload.js";
import { enqueuePolicyJob } from "../../queue/policy.queue.js";
import { singlePolicySchema } from "./policy.schemas.js";

export const policyRouter = Router();
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100000).default(10000),
  q: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  status: z.preprocess((val) => (val === "" ? undefined : val), z.enum(["QUEUED", "PROCESSING", "ISSUED", "FAILED", "VERIFY_FAILED", "NEED_MANUAL_REVIEW"]).optional())
});

policyRouter.get("/", asyncHandler(async (req, res) => {
  const { page, limit, q, status } = pagination.parse(req.query);
  
  const userIdQuery = req.query.userId ? String(req.query.userId) : undefined;
  let own = {};
  if (req.user!.role === UserRole.CTV) {
    own = {
      OR: [
        { userId: req.user!.id },
        { revenueUserId: req.user!.id }
      ]
    };
  } else if (req.user!.role === UserRole.MANAGER) {
    const ctvUsers = await prisma.user.findMany({
      where: { creatorId: req.user!.id },
      select: { id: true }
    });
    const allowedUserIds = [req.user!.id, ...ctvUsers.map(u => u.id)];
    if (userIdQuery) {
      if (allowedUserIds.includes(userIdQuery)) {
        own = {
          OR: [
            { userId: userIdQuery },
            { revenueUserId: userIdQuery }
          ]
        };
      } else {
        own = { userId: { in: [] } };
      }
    } else {
      own = {
        OR: [
          { userId: { in: allowedUserIds } },
          { revenueUserId: { in: allowedUserIds } }
        ]
      };
    }
  } else {
    own = userIdQuery ? {
      OR: [
        { userId: userIdQuery },
        { revenueUserId: userIdQuery }
      ]
    } : {};
  }
  
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  
  let dateFilter = {};
  if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    dateFilter = {
      issuedAt: {
        gte: start,
        lt: end
      }
    };
  }

  const where = { 
    ...own, 
    ...dateFilter,
    ...(status ? { status } : {}), 
    ...(q ? { OR: [{ plateNumber: { contains: q } }, { customerName: { contains: q } }, { certificateNumber: { contains: q } }] } : {}) 
  };

  const [items, total] = await Promise.all([
    prisma.policy.findMany({ where, include: { user: { select: { username: true, fullName: true } } }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.policy.count({ where })
  ]);
  res.json({ items, total, page, limit });
}));

policyRouter.post("/single", asyncHandler(async (req, res) => {
  const input = singlePolicySchema.parse(req.body);

  // Chống phát hành trùng (Double Submit)
  const plate = input.plateNumber;
  const chassis = input.chassisNumber;
  const engine = input.engineNumber;

  const hasPlate = plate && plate !== "0";
  const hasChassis = chassis && chassis !== "0";
  const hasEngine = engine && engine !== "0";

  let duplicateCheck: any = null;
  if (hasPlate) {
    duplicateCheck = await prisma.policy.findFirst({
      where: {
        plateNumber: plate,
        status: { in: [PolicyStatus.QUEUED, PolicyStatus.PROCESSING] }
      }
    });
  } else if (hasChassis && hasEngine) {
    duplicateCheck = await prisma.policy.findFirst({
      where: {
        chassisNumber: chassis,
        engineNumber: engine,
        status: { in: [PolicyStatus.QUEUED, PolicyStatus.PROCESSING] }
      }
    });
  }

  if (duplicateCheck) {
    throw new AppError(409, "Đơn hàng cho xe này đang được xử lý trên hệ thống. Vui lòng không gửi trùng lặp.", "DUPLICATE_JOB");
  }

  const specialUsernames = ["0962731468", "0906643381", "0942542249", "0981740680", "0931183389"];
  const specialFullNames = ["LINH", "PHƯỚC", "YÊN", "DIỄM", "NHI"];
  const isSpecial = req.user && (
    specialUsernames.includes(req.user.username) || 
    (req.user.fullName && specialFullNames.includes(req.user.fullName.toUpperCase()))
  );

  if (isSpecial) {
    const agent = (input.agent || "").trim();
    const phone = (input.phone || "").trim();
    if (!agent && !phone) {
      throw new AppError(422, "Vui lòng nhập Số điện thoại nhận GCN hoặc Đại lý");
    }
  }

  let revenueUserId = req.user!.id;
  let issuerName = input.issuerName;

  if (input.revenueUserId) {
    const targetUser = await prisma.user.findUnique({ where: { id: input.revenueUserId } });
    if (targetUser) {
      revenueUserId = targetUser.id;
      issuerName = targetUser.fullName;
    }
  } else if (input.issuerName) {
    const allUsers = await prisma.user.findMany();
    const normalizedIssuer = input.issuerName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toUpperCase().trim();
    const matchedUser = allUsers.find(u => {
      const normalizedFullName = (u.fullName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d").toUpperCase().trim();
      return normalizedFullName.includes(normalizedIssuer) || normalizedIssuer.includes(normalizedFullName);
    });
    if (matchedUser) {
      revenueUserId = matchedUser.id;
      issuerName = matchedUser.fullName;
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({ data: { userId: req.user!.id, type: JobType.SINGLE_POLICY, payload: { ...input, issuerName, revenueUserId } } });
    const policy = await tx.policy.create({ data: { ...input, issuerName, userId: req.user!.id, revenueUserId, jobId: job.id } });
    return { job, policy };
  });
  const queued = await enqueuePolicyJob({ type: "SINGLE_POLICY", dbJobId: result.job.id, policyId: result.policy.id });
  await prisma.job.update({ where: { id: result.job.id }, data: { bullJobId: String(queued.id) } });
  await audit(req, "POLICY_SINGLE_ENQUEUE", { policyId: result.policy.id, jobId: result.job.id, plateNumber: input.plateNumber });
  res.status(202).json({ jobId: result.job.id, policyId: result.policy.id, status: "QUEUED" });
}));

// Excel upload đã bị loại bỏ theo yêu cầu

policyRouter.post("/ocr", ocrUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError(400, "Vui lòng chọn file ảnh hoặc PDF để nhận diện");
  }

  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    try { fs.unlinkSync(req.file.path); } catch {}
    throw new AppError(400, "Chức năng OCR chưa được cấu hình GEMINI_API_KEY trên máy chủ");
  }

  const filePath = req.file.path;
  let fileBase64 = "";
  try {
    fileBase64 = fs.readFileSync(filePath, { encoding: "base64" });
  } catch (err) {
    try { fs.unlinkSync(filePath); } catch {}
    throw new AppError(500, "Không thể đọc tệp tin đã tải lên");
  }

  const ext = path.extname(req.file.originalname).toLowerCase();
  let mimeType = "image/jpeg";
  if (ext === ".png") mimeType = "image/png";
  else if (ext === ".pdf") mimeType = "application/pdf";

  const prompt = `Bạn là chuyên gia trích xuất dữ liệu từ hình ảnh hoặc tài liệu đăng ký xe, đăng kiểm xe, hoặc giấy tờ xe của Việt Nam.
Hãy đọc ảnh/tài liệu này và trích xuất ra các trường thông tin sau và trả về dưới dạng JSON thô.
Cấu trúc JSON cần trả về:
{
  "phone": "Số điện thoại nhận GCN (Nếu thấy số điện thoại của khách hàng/chủ xe viết tay hoặc in trên ảnh, định dạng 10 số. Nếu không thấy thì để null)",
  "customerName": "Họ và tên chủ xe (phải viết IN HOA có dấu, ví dụ NGUYỄN VĂN A)",
  "address": "Địa chỉ ghi trên đăng ký xe (đầy đủ tỉnh thành, quận huyện, ví dụ: 123 Đường A, Phường B, Quận C, Hà Nội)",
  "plateNumber": "Biển số xe (ví dụ: 30A12345 hoặc 29C-123.45. Chuyển về dạng viết liền hoặc có dấu gạch ngang theo đăng ký xe, ví dụ 30A-123.45. Nếu không có biển số, điền null)",
  "chassisNumber": "Số khung (Chữ in hoa viết liền, ví dụ RLHA123...) hoặc null nếu không đọc được",
  "engineNumber": "Số máy (Chữ in hoa viết liền, ví dụ 1NZ123...) hoặc null nếu không đọc được",
  "seatCount": "Số chỗ ngồi (Phải trả về kiểu số nguyên, ví dụ: 5. Nếu không thấy ghi rõ chỗ ngồi nhưng là dòng xe quen thuộc, hãy điền số chỗ phù hợp, ví dụ xe sedan/hatchback điền 5, xe bán tải điền 5, xe tải điền 3. Nếu hoàn toàn không xác định được, điền 5)"
}
Lưu ý quan trọng: Chỉ trả về chuỗi JSON thô chứa dữ liệu trích xuất được. Tuyệt đối không bao bọc bởi markdown block \`\`\`json hay bất cứ giải thích nào khác.`;

  const callGeminiModel = async (model: string) => {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: fileBase64
                }
              },
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(errBody.error?.message || `Lỗi kết nối Gemini API (${response.status})`);
    }

    return response.json() as any;
  };

  try {
    let resData: any;
    try {
      resData = await callGeminiModel("gemini-2.5-flash");
    } catch (firstErr: any) {
      const errMsg = String(firstErr.message || "").toLowerCase();
      const isRateLimit = errMsg.includes("high demand") || 
                          errMsg.includes("rate limit") || 
                          errMsg.includes("429") || 
                          errMsg.includes("503") || 
                          errMsg.includes("quota");
      if (isRateLimit) {
        req.log.warn("Gemini 2.5 Flash is overloaded, trying fallback model gemini-1.5-flash...");
        // Wait 300ms before fallback
        await new Promise(r => setTimeout(r, 300));
        resData = await callGeminiModel("gemini-1.5-flash");
      } else {
        throw firstErr;
      }
    }

    const textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!textResult) {
      throw new Error("Không nhận diện được nội dung từ phản hồi của Gemini");
    }

    const parsedData = JSON.parse(textResult.trim());
    
    res.json({
      success: true,
      data: {
        phone: parsedData.phone || "",
        customerName: parsedData.customerName || "",
        address: parsedData.address || "",
        plateNumber: parsedData.plateNumber || "",
        chassisNumber: parsedData.chassisNumber || "",
        engineNumber: parsedData.engineNumber || "",
        seatCount: typeof parsedData.seatCount === "number" ? parsedData.seatCount : 5
      }
    });

  } catch (err) {
    req.log.error(err, "Gemini OCR failed");
    res.status(500).json({
      success: false,
      message: err instanceof Error ? err.message : "Có lỗi xảy ra khi nhận diện thông tin"
    });
  } finally {
    try { fs.unlinkSync(filePath); } catch {}
  }
}));

policyRouter.get("/export", asyncHandler(async (req, res) => {
  const user = req.user!;
  const userIdQuery = req.query.userId ? String(req.query.userId) : undefined;
  let own = {};
  if (user.role === UserRole.CTV) {
    own = {
      OR: [
        { userId: user.id },
        { revenueUserId: user.id }
      ]
    };
  } else if (user.role === UserRole.MANAGER) {
    const ctvUsers = await prisma.user.findMany({
      where: { creatorId: user.id },
      select: { id: true }
    });
    const allowedUserIds = [user.id, ...ctvUsers.map(u => u.id)];
    if (userIdQuery) {
      if (allowedUserIds.includes(userIdQuery)) {
        own = {
          OR: [
            { userId: userIdQuery },
            { revenueUserId: userIdQuery }
          ]
        };
      } else {
        own = { userId: { in: [] } };
      }
    } else {
      own = {
        OR: [
          { userId: { in: allowedUserIds } },
          { revenueUserId: { in: allowedUserIds } }
        ]
      };
    }
  } else {
    own = userIdQuery ? {
      OR: [
        { userId: userIdQuery },
        { revenueUserId: userIdQuery }
      ]
    } : {};
  }
  
  const month = req.query.month ? Number(req.query.month) : undefined;
  const year = req.query.year ? Number(req.query.year) : undefined;
  
  let dateFilter = {};
  if (month && year) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    dateFilter = {
      issuedAt: {
        gte: start,
        lt: end
      }
    };
  }

  const where: Prisma.PolicyWhereInput = {
    ...own,
    ...dateFilter
  };
  
  const policies = await prisma.policy.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { user: { select: { username: true, fullName: true } } }
  });

  const exportData = policies.map((p, index) => {
    const totalPremium = p.premium ? Number(p.premium) : 0;
    const passengerTotalFee = (p.passengerCount || 0) * (p.passengerFee || 0);
    const premiumTnds = p.premium ? Math.max(0, totalPremium - passengerTotalFee) : "";

    const formatDate = (date: Date | null) => {
      if (!date) return "";
      const d = new Date(date);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };
    const cleanGCN = (gcn: string | null | undefined) => {
      if (!gcn) return "";
      const parts = gcn.split("_");
      if (parts.length > 1) {
        const lastPart = parts[parts.length - 1];
        return lastPart.replace(/\.pdf$/i, "");
      }
      return gcn.replace(/\.pdf$/i, "");
    };

    return {
      "STT": index + 1,
      "GCN": cleanGCN(p.certificateNumber),
      "TÊN KHÁCH HÀNG": p.customerName,
      "BIỂN SỐ": p.plateNumber,
      "NGÀY CẤP": formatDate(p.issuedAt),
      "NGÀY HIỆU LỰC": formatDate(p.effectiveDate),
      "PHÍ TNDS": premiumTnds,
      "LP NNTX": passengerTotalFee,
      "TỔNG PHÍ": p.premium ? totalPremium : "",
      "TRẠNG THÁI": p.status === "ISSUED" ? "Đã phát hành" : p.status === "FAILED" ? "Thất bại" : p.status === "PROCESSING" ? "Đang xử lý" : "Chờ phát hành",
      "NGƯỜI CẤP": p.issuerName || p.user?.fullName || "",
      "ĐẠI LÝ": p.agent || "",
      "SDT": p.phone || ""
    };
  });

  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.json_to_sheet(exportData);
  xlsx.utils.book_append_sheet(wb, ws, "DanhSachDon");

  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", 'attachment; filename="danh_sach_don.xlsx"');
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
}));

policyRouter.get("/lookup", asyncHandler(async (req, res) => {
  const plate = String(req.query.plate ?? "").trim();
  if (!plate || plate.length < 2) {
    return res.json({ items: [] });
  }

  let own: Record<string, unknown> = {};
  if (req.user!.role === UserRole.CTV) {
    own = { userId: req.user!.id };
  } else if (req.user!.role === UserRole.MANAGER) {
    const ctvUsers = await prisma.user.findMany({
      where: { creatorId: req.user!.id },
      select: { id: true }
    });
    const allowedIds = [req.user!.id, ...ctvUsers.map(u => u.id)];
    own = { userId: { in: allowedIds } };
  }

  const items = await prisma.policy.findMany({
    where: {
      ...own,
      plateNumber: { contains: plate }
    },
    include: { user: { select: { username: true, fullName: true } } },
    orderBy: { createdAt: "desc" },
    take: 10
  });
  res.json({ items });
}));

policyRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const policy = assertFound(await prisma.policy.findUnique({ where: { id }, include: { user: { select: { username: true, fullName: true } }, job: true } }));
  if (req.user!.role === UserRole.CTV && policy.userId !== req.user!.id) throw new AppError(403, "Bạn không có quyền xem đơn này");
  res.json(policy);
}));

policyRouter.get("/:id/pdf", asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const policy = assertFound(await prisma.policy.findUnique({ where: { id } }));
  if (req.user!.role === UserRole.CTV && policy.userId !== req.user!.id) throw new AppError(403, "Bạn không có quyền tải GCN");
  
  if (policy.pdfPath) {
    const absolutePath = path.resolve(policy.pdfPath);
    if (fs.existsSync(absolutePath)) {
      const cleanName = policy.plateNumber
        ? policy.plateNumber.toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim()
        : "GCN";
      return res.download(absolutePath, `${cleanName || "GCN"}.pdf`);
    }
  }

  if (!policy.pdfUrl) throw new AppError(404, "GCN PDF chưa sẵn sàng");
  res.redirect(policy.pdfUrl);
}));
