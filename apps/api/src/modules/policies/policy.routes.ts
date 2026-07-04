import path from "node:path";
import { Router } from "express";
import { JobType, UserRole, Prisma } from "@prisma/client";
import xlsx from "xlsx";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { audit } from "../../lib/audit.js";
import { AppError, assertFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { excelUpload } from "../../middleware/upload.js";
import { enqueuePolicyJob } from "../../queue/policy.queue.js";
import { inspectExcel, cleanExcelFile } from "./excel.service.js";
import { singlePolicySchema } from "./policy.schemas.js";

export const policyRouter = Router();
const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100000).default(10000),
  q: z.preprocess((val) => (val === "" ? undefined : val), z.string().optional()),
  status: z.preprocess((val) => (val === "" ? undefined : val), z.enum(["QUEUED", "PROCESSING", "ISSUED", "FAILED"]).optional())
});

policyRouter.get("/", asyncHandler(async (req, res) => {
  const { page, limit, q, status } = pagination.parse(req.query);
  
  const userIdQuery = req.query.userId ? String(req.query.userId) : undefined;
  let own = {};
  if (req.user!.role === UserRole.CTV) {
    own = { userId: req.user!.id };
  } else if (req.user!.role === UserRole.MANAGER) {
    const ctvUsers = await prisma.user.findMany({
      where: { creatorId: req.user!.id },
      select: { id: true }
    });
    const allowedUserIds = [req.user!.id, ...ctvUsers.map(u => u.id)];
    if (userIdQuery) {
      if (allowedUserIds.includes(userIdQuery)) {
        own = { userId: userIdQuery };
      } else {
        own = { userId: { in: [] } };
      }
    } else {
      own = { userId: { in: allowedUserIds } };
    }
  } else {
    own = userIdQuery ? { userId: userIdQuery } : {};
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

  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({ data: { userId: req.user!.id, type: JobType.SINGLE_POLICY, payload: input } });
    const policy = await tx.policy.create({ data: { ...input, userId: req.user!.id, jobId: job.id } });
    return { job, policy };
  });
  const queued = await enqueuePolicyJob({ type: "SINGLE_POLICY", dbJobId: result.job.id, policyId: result.policy.id });
  await prisma.job.update({ where: { id: result.job.id }, data: { bullJobId: String(queued.id) } });
  await audit(req, "POLICY_SINGLE_ENQUEUE", { policyId: result.policy.id, jobId: result.job.id, plateNumber: input.plateNumber });
  res.status(202).json({ jobId: result.job.id, policyId: result.policy.id, status: "QUEUED" });
}));

policyRouter.post("/excel", excelUpload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "Vui lòng chọn file Excel");
  cleanExcelFile(req.file.path);
  let info;
  try { info = inspectExcel(req.file.path); } catch (error) { throw error; }
  const result = await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({ data: { userId: req.user!.id, type: JobType.EXCEL_UPLOAD, payload: { filePath: req.file!.path, originalName: req.file!.originalname, rowCount: info.rowCount } } });
    const batch = await tx.batchUpload.create({ data: { userId: req.user!.id, jobId: job.id, filePath: req.file!.path, originalName: req.file!.originalname, totalRows: info.rowCount } });
    return { job, batch };
  });
  const queued = await enqueuePolicyJob({ type: "EXCEL_UPLOAD", dbJobId: result.job.id, batchId: result.batch.id, filePath: req.file.path });
  await prisma.job.update({ where: { id: result.job.id }, data: { bullJobId: String(queued.id) } });
  await audit(req, "POLICY_EXCEL_ENQUEUE", { batchId: result.batch.id, jobId: result.job.id, fileName: path.basename(req.file.path), rows: info.rowCount });
  res.status(202).json({ jobId: result.job.id, batchId: result.batch.id, totalRows: info.rowCount, status: "QUEUED" });
}));
policyRouter.get("/export", asyncHandler(async (req, res) => {
  const user = req.user!;
  const userIdQuery = req.query.userId ? String(req.query.userId) : undefined;
  let own = {};
  if (user.role === UserRole.CTV) {
    own = { userId: user.id };
  } else if (user.role === UserRole.MANAGER) {
    const ctvUsers = await prisma.user.findMany({
      where: { creatorId: user.id },
      select: { id: true }
    });
    const allowedUserIds = [user.id, ...ctvUsers.map(u => u.id)];
    if (userIdQuery) {
      if (allowedUserIds.includes(userIdQuery)) {
        own = { userId: userIdQuery };
      } else {
        own = { userId: { in: [] } };
      }
    } else {
      own = { userId: { in: allowedUserIds } };
    }
  } else {
    own = userIdQuery ? { userId: userIdQuery } : {};
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
  if (!policy.pdfPath) throw new AppError(404, "GCN PDF chưa sẵn sàng");
  
  const cleanName = policy.plateNumber.toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  res.download(path.resolve(policy.pdfPath), `${cleanName}.pdf`);
}));
