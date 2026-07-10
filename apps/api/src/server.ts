import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { startCleanupCron } from "./lib/cleanup.js";

async function recoverStuckJobs() {
  try {
    const threshold = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago
    const stuckJobs = await prisma.job.findMany({
      where: {
        status: { in: ["PROCESSING", "QUEUED"] },
        createdAt: { lt: threshold }
      }
    });

    if (stuckJobs.length > 0) {
      console.log(`[StartupRecovery] Phát hiện ${stuckJobs.length} jobs bị treo. Đang khôi phục...`);
      for (const job of stuckJobs) {
        await prisma.job.update({
          where: { id: job.id },
          data: {
            status: "NEED_MANUAL_REVIEW",
            error: "Hệ thống bị khởi động lại hoặc worker bị dừng đột ngột trong khi xử lý."
          }
        });
        await prisma.policy.updateMany({
          where: { jobId: job.id, status: { in: ["PROCESSING", "QUEUED"] } },
          data: {
            status: "NEED_MANUAL_REVIEW",
            error: "Hệ thống bị khởi động lại hoặc worker bị dừng đột ngột trong khi xử lý."
          }
        });
      }
      console.log("[StartupRecovery] Hoàn tất khôi phục jobs treo.");
    }
  } catch (err) {
    console.error("[StartupRecovery] Lỗi khi quét khôi phục jobs treo:", err);
  }
}

const server = app.listen(env.PORT, () => {
  console.log(`DIIN API listening on http://localhost:${env.PORT}`);
  startCleanupCron();
  void recoverStuckJobs();
});

async function shutdown() {
  server.close();
  await redis?.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
