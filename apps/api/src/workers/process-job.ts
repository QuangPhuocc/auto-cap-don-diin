import { JobStatus, PolicyStatus } from "@prisma/client";
import path from "node:path";
import fs from "node:fs/promises";
import { DiinService } from "../automation/diin.service.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";
import type { PolicyQueueData } from "../queue/policy.queue.js";

/**
 * prismaUpdateWithRetry — Wrapper thực hiện câu lệnh Prisma với cơ chế tự động thử lại nếu DB bị khóa (Lock/Deadlock).
 */
async function prismaUpdateWithRetry<T>(fn: () => Promise<T>, retries = 5, delay = 500): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`[PrismaRetry] Gặp lỗi DB (lần ${i + 1}/${retries}), đang thử lại...`, err);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error("Prisma operation failed after retries");
}

/**
 * logBackupRecovery — Lưu thông tin cấp đơn thành công vào tệp JSON dự phòng nếu ghi vào DB thất bại hoàn toàn.
 * Tránh việc cổng DIIN đã trừ tiền/phát hành nhưng DB chưa cập nhật.
 */
async function logBackupRecovery(data: any) {
  try {
    const logDir = path.resolve("./logs");
    await fs.mkdir(logDir, { recursive: true });
    const logPath = path.join(logDir, "issued_policies_backup.json");
    const record = {
      timestamp: new Date().toISOString(),
      ...data
    };
    await fs.appendFile(logPath, JSON.stringify(record) + "\n", "utf8");
    console.log(`[Backup] Đã sao lưu dữ liệu khôi phục khẩn cấp tại: ${logPath}`);
  } catch (err) {
    console.error("[Backup] Thất bại nghiêm trọng: Không thể ghi file sao lưu khôi phục!", err);
  }
}

/**
 * processPolicyJob — Xử lý 1 job SINGLE_POLICY.
 */
export async function processPolicyJob(data: PolicyQueueData) {
  // Đánh dấu job bắt đầu xử lý
  await prismaUpdateWithRetry(() => prisma.job.update({
    where: { id: data.dbJobId },
    data: {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      attempts: { increment: 1 },
      progress: 5
    }
  }));

  // Lấy 1 tab từ pool (browser dùng chung, session DIIN đã đăng nhập)
  const diin = await DiinService.create(data.dbJobId);
  let issuedResult: any = null;

  try {
    const policy = await prismaUpdateWithRetry(() => prisma.policy.update({
      where: { id: data.policyId },
      data: { status: PolicyStatus.PROCESSING }
    }));

    // Kiểm tra thời gian chờ trong queue (tránh xử lý đơn quá cũ)
    const queueTimeMs = Date.now() - policy.createdAt.getTime();
    if (queueTimeMs > 3600000) {
      throw new Error(`Quá thời gian chờ xếp hàng (đã chờ ${Math.round(queueTimeMs / 60000)} phút). Đơn đã tự động hủy.`);
    }

    // Phát hành đơn (chạy playwright và download PDF đồng bộ)
    const result = await diin.issueSingle(policy, policy.id);
    issuedResult = result; // Lưu lại kết quả để backup nếu ghi DB lỗi

    // Lưu kết quả thành công vào DB
    await prismaUpdateWithRetry(() => prisma.policy.update({
      where: { id: policy.id },
      data: {
        certificateNumber: result.certificateNumber,
        serialNumber: result.serialNumber || result.certificateNumber,
        premium: result.premium != null ? String(result.premium) : undefined,
        pdfUrl: result.pdfUrl ?? undefined,
        pdfPath: result.pdfPath ?? undefined,
        plateNumber: result.plateNumber || policy.plateNumber,
        customerName: result.customerName || policy.customerName,
        status: PolicyStatus.ISSUED,
        issuedAt: new Date(),
        error: null
      }
    }));

    await prismaUpdateWithRetry(() => prisma.job.update({
      where: { id: data.dbJobId },
      data: { status: JobStatus.COMPLETED, progress: 100, completedAt: new Date(), error: null }
    }));

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isVerifyFailed = error instanceof AppError && error.code === "POLICY_VERIFICATION_FAILED";
    
    const targetPolicyStatus = isVerifyFailed ? PolicyStatus.VERIFY_FAILED : PolicyStatus.FAILED;
    const targetJobStatus = isVerifyFailed ? JobStatus.VERIFY_FAILED : JobStatus.FAILED;

    // Chụp screenshot debug khi lỗi
    try {
      const screenshotPath = path.resolve(`./debug/screenshot-error-${data.dbJobId}.png`);
      await diin.captureScreenshot(screenshotPath);
      console.log(`[Worker] Screenshot lỗi: ${screenshotPath}`);
    } catch {
      // Bỏ qua lỗi screenshot
    }

    // Nếu đã phát hành thành công trên DIIN nhưng ghi DB thất bại (hoặc lỗi verify), ghi backup log
    if (issuedResult) {
      await logBackupRecovery({
        jobId: data.dbJobId,
        policyId: data.policyId,
        result: issuedResult,
        error: message
      });
    }

    // Cập nhật trạng thái thất bại vào DB
    try {
      await prismaUpdateWithRetry(() => prisma.policy.update({
        where: { id: data.policyId },
        data: { status: targetPolicyStatus, error: message }
      }));
      await prismaUpdateWithRetry(() => prisma.job.update({
        where: { id: data.dbJobId },
        data: { status: targetJobStatus, error: message }
      }));
    } catch (dbErr) {
      console.error("[Worker] Không thể cập nhật trạng thái lỗi vào DB!", dbErr);
      // Ghi backup log khẩn cấp trong trường hợp DB sập hoàn toàn
      await logBackupRecovery({
        jobId: data.dbJobId,
        policyId: data.policyId,
        result: issuedResult || { status: "unknown" },
        error: `DB_WRITE_ERROR: ${String(dbErr)} | OriginalError: ${message}`
      });
    }

    throw error;
  } finally {
    // Đóng tab, KHÔNG đóng browser
    await diin.close();
  }
}
