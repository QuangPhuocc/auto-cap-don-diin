import { JobStatus, PolicyStatus } from "@prisma/client";
import path from "node:path";
import { DiinService } from "../automation/diin.service.js";
import { prisma } from "../lib/prisma.js";
import type { PolicyQueueData } from "../queue/policy.queue.js";

/**
 * processPolicyJob — Xử lý 1 job SINGLE_POLICY.
 *
 * Kiến trúc multi-tab:
 * - Gọi DiinService.create() → lấy tab mới từ DiinBrowserPool (browser dùng chung)
 * - Sau khi xong, đóng tab (không đóng browser)
 * - Nhiều job có thể chạy song song nhờ BullMQ concurrency > 1
 *
 * Note: Excel upload đã bị loại bỏ hoàn toàn.
 */
export async function processPolicyJob(data: PolicyQueueData) {
  // Đánh dấu job bắt đầu xử lý
  await prisma.job.update({
    where: { id: data.dbJobId },
    data: {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      attempts: { increment: 1 },
      progress: 5
    }
  });

  // Lấy 1 tab từ pool (browser dùng chung, session DIIN đã đăng nhập)
  const diin = await DiinService.create(data.dbJobId);

  try {
    const policy = await prisma.policy.update({
      where: { id: data.policyId },
      data: { status: PolicyStatus.PROCESSING }
    });

    // Kiểm tra thời gian chờ trong queue
    // Tăng lên 3600s (1 tiếng) để cho phép 50+ người dùng đồng thời
    const queueTimeMs = Date.now() - policy.createdAt.getTime();
    if (queueTimeMs > 3600000) {
      throw new Error(`Quá thời gian chờ xếp hàng (đã chờ ${Math.round(queueTimeMs / 60000)} phút). Đơn đã tự động hủy.`);
    }

    // Phát hành đơn
    const result = await diin.issueSingle(policy, policy.id);

    // Lưu kết quả
    await prisma.policy.update({
      where: { id: policy.id },
      data: {
        certificateNumber: result.certificateNumber,
        serialNumber: result.serialNumber,
        premium: result.premium != null ? String(result.premium) : undefined,
        pdfUrl: result.pdfUrl ?? undefined,
        pdfPath: result.pdfPath ?? undefined,
        plateNumber: result.plateNumber || policy.plateNumber,
        customerName: result.customerName || policy.customerName,
        status: PolicyStatus.ISSUED,
        issuedAt: new Date(),
        error: null
      }
    });

    await prisma.job.update({
      where: { id: data.dbJobId },
      data: { status: JobStatus.COMPLETED, progress: 100, completedAt: new Date(), error: null }
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    // Chụp screenshot debug khi lỗi
    try {
      const screenshotPath = path.resolve(`./debug/screenshot-error-${data.dbJobId}.png`);
      await diin.captureScreenshot(screenshotPath);
      console.log(`[Worker] Screenshot lỗi: ${screenshotPath}`);
    } catch {
      // Bỏ qua lỗi screenshot
    }

    await prisma.job.update({
      where: { id: data.dbJobId },
      data: { status: JobStatus.FAILED, error: message }
    });
    await prisma.policy.update({
      where: { id: data.policyId },
      data: { status: PolicyStatus.FAILED, error: message }
    });

    throw error;
  } finally {
    // Đóng tab, KHÔNG đóng browser (browser dùng chung)
    await diin.close();
  }
}
