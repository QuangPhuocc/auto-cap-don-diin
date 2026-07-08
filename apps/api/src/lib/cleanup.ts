import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export function startCleanupCron() {
  console.log("[Cleanup] Đã khởi tạo tiến trình tự động dọn dẹp file tạm (hằng ngày)...");
  
  const runCleanup = async () => {
    try {
      console.log("[Cleanup] Bắt đầu dọn dẹp file tạm...");
      const now = Date.now();
      const maxAgeMs = 3 * 24 * 60 * 60 * 1000; // 3 ngày
      
      // Dọn dẹp folder downloads (PDF)
      const files = await fs.readdir(env.PDF_DIR).catch(() => [] as string[]);
      let pdfCount = 0;
      for (const file of files) {
        if (file.endsWith(".pdf")) {
          const filePath = path.join(env.PDF_DIR, file);
          const stat = await fs.stat(filePath).catch(() => null);
          if (stat && now - stat.mtimeMs > maxAgeMs) {
            await fs.unlink(filePath).catch(() => {});
            pdfCount++;
          }
        }
      }
      if (pdfCount > 0) {
        console.log(`[Cleanup] Đã xóa ${pdfCount} file PDF cũ (quá 3 ngày).`);
      }
      
      // Dọn dẹp folder debug screenshots
      const debugDir = "./debug";
      const debugFiles = await fs.readdir(debugDir).catch(() => [] as string[]);
      let debugCount = 0;
      for (const file of debugFiles) {
        if (file.endsWith(".png") || file.endsWith(".html")) {
          const filePath = path.join(debugDir, file);
          const stat = await fs.stat(filePath).catch(() => null);
          if (stat && now - stat.mtimeMs > maxAgeMs) {
            await fs.unlink(filePath).catch(() => {});
            debugCount++;
          }
        }
      }
      if (debugCount > 0) {
        console.log(`[Cleanup] Đã xóa ${debugCount} file debug cũ (quá 3 ngày).`);
      }
    } catch (err) {
      console.error("[Cleanup] Lỗi dọn dẹp:", err);
    }
  };

  // Chạy ngay lập tức khi khởi động, sau đó lặp lại mỗi 24 tiếng
  runCleanup();
  setInterval(runCleanup, 24 * 60 * 60 * 1000);
}
