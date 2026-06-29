import { Client } from "ssh2";

const conn = new Client();

const envContent = `NODE_ENV=production
PORT=4000
WEB_URL=http://103.211.200.219:5173
DATABASE_URL=file:/var/database/dev.db
REDIS_URL=redis://127.0.0.1:6379
JWT_SECRET=diin-local-dev-secret-0941941049-allow-real-issue
JWT_EXPIRES_IN=8h
DIIN_BASE_URL=https://daily.diin.com.vn
DIIN_USERNAME=0906643381
DIIN_PASSWORD=0906643381@
DIIN_HEADLESS=true
DIIN_ALLOW_ISSUE=true
DIIN_TIMEOUT_MS=45000
DIIN_QUEUE_MODE=bullmq
UPLOAD_DIR=./uploads
PDF_DIR=./downloads
MAX_UPLOAD_MB=20
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
ADMIN_FULL_NAME=Quản trị viên
`;

const commands = [
  // 1. Install Redis Server on VPS for BullMQ
  "apt-get update && apt-get install -y redis-server",
  "systemctl start redis-server && systemctl enable redis-server",

  // 2. Create external database folder to prevent code updates from deleting data
  "mkdir -p /var/database",

  // 3. Stop existing PM2 apps
  "pm2 delete all || true",
  "pkill -f node || true",
  "pkill -f vite || true",
  
  // 4. Install pnpm globally
  "npm i -g pnpm",
  
  // 5. Clone fresh repository code
  "rm -rf /root/auto-cap-don-diin",
  "git clone https://github.com/QuangPhuocc/auto-cap-don-diin.git /root/auto-cap-don-diin",
  
  // 6. Write env configurations
  `cat << 'EOF' > /root/auto-cap-don-diin/.env\n${envContent}\nEOF`,
  `cat << 'EOF' > /root/auto-cap-don-diin/apps/api/.env\n${envContent}\nEOF`,

  // 7. Install libraries
  "cd /root/auto-cap-don-diin && pnpm install --no-frozen-lockfile",

  // 7b. Generate Prisma client
  "cd /root/auto-cap-don-diin/apps/api && npx prisma generate",

  // 8. Build the workspaces
  "cd /root/auto-cap-don-diin && pnpm run build",

  // 9. Sync SQLite database (points to /var/database/dev.db)
  "cd /root/auto-cap-don-diin/apps/api && npx prisma db push --accept-data-loss",
  "cd /root/auto-cap-don-diin/apps/api && npx prisma db seed",

  // 10. Playwright browsers and system deps
  "npx playwright install chromium --with-deps",

  // 11. Start applications under PM2 (API, Queue worker and Web UI)
  "cd /root/auto-cap-don-diin/apps/api && pm2 start dist/src/server.js --name diin-api",
  "cd /root/auto-cap-don-diin/apps/api && pm2 start dist/src/workers/diin.worker.js --name diin-worker",
  "cd /root/auto-cap-don-diin/apps/web && pm2 start 'npx vite preview --host 0.0.0.0 --port 5173' --name diin-web",
  
  // 12. Save PM2 state
  "pm2 save",
  
  // 13. View status
  "pm2 list"
];

conn.on("ready", () => {
  console.log("SSH Connection ready for deployment...\n");
  
  let i = 0;
  function runNext() {
    if (i >= commands.length) {
      console.log("\nDeployment completed successfully!");
      conn.end();
      return;
    }
    
    const cmd = commands[i];
    console.log(`[EXECUTE] ${cmd.split("\n")[0]}`);
    conn.exec(cmd, (err, stream) => {
      if (err) {
        console.error(`Error: ${cmd}`, err);
        conn.end();
        return;
      }
      stream.on("close", (code) => {
        console.log(`[FINISHED] code: ${code}\n`);
        i++;
        runNext();
      }).on("data", (data) => {
        process.stdout.write(data);
      }).stderr.on("data", (data) => {
        process.stderr.write(data);
      });
    });
  }
  
  runNext();
}).connect({
  host: "103.211.200.219",
  port: 22,
  username: "root",
  password: "Ku7Vrtq1ephRUXUx"
});
