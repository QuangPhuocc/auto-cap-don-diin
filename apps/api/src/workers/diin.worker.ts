import "dotenv/config";
import { Worker } from "bullmq";
import { diinPool } from "../automation/diin.pool.js";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";
import { POLICY_QUEUE, type PolicyQueueData } from "../queue/policy.queue.js";
import { processPolicyJob } from "./process-job.js";

if (!redis) {
  console.error("[Worker] Redis không khả dụng — worker không thể khởi động");
  process.exit(1);
}

const redisConnection = redis;

/**
 * Số tab song song tối đa.
 * Mặc định: 40 (cấu hình theo DIIN_WORKER_CONCURRENCY).
 * Với 1 tài khoản DIIN, DIIN cho phép mở nhiều tab — tận dụng điều này.
 */
const CONCURRENCY = env.DIIN_WORKER_CONCURRENCY;
console.log(`[Worker] Khởi động với concurrency = ${CONCURRENCY} tabs song song`);

const worker = new Worker<PolicyQueueData, void, string>(
  POLICY_QUEUE,
  async (job) => {
    await processPolicyJob(job.data);
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY,
    // Tăng lockDuration để tránh BullMQ coi job dài là "stalled"
    // Playwright job có thể mất 45-120 giây
    lockDuration: 180000,       // Lock 3 phút
    lockRenewTime: 60000,       // Renew lock mỗi 60s
    maxStalledCount: 0,         // Không auto-retry khi stalled (tránh phát hành trùng)
    stalledInterval: 30000,     // Kiểm tra stalled mỗi 30s
  }
);

worker.on("completed", (job) => {
  console.log(`[Worker] ✅ Job ${job.id} hoàn thành`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] ❌ Job ${job?.id} thất bại:`, err.message);
});

worker.on("stalled", (jobId) => {
  console.warn(`[Worker] ⚠️ Job ${jobId} bị stalled — kiểm tra tab đang chạy`);
});

worker.on("error", (err) => {
  console.error("[Worker] Lỗi worker:", err);
});

/**
 * Graceful shutdown:
 * 1. Đóng worker (không nhận job mới)
 * 2. Đóng browser pool (đóng tất cả tab và browser)
 * 3. Thoát process
 */
async function shutdown(signal: string) {
  console.log(`[Worker] Nhận ${signal} — đang shutdown gracefully...`);
  await worker.close();
  await diinPool.destroy();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
