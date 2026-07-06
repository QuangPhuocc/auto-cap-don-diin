import { Client } from "ssh2";
import dotenv from "dotenv";
import path from "node:path";

// Load dotenv to fetch GEMINI_API_KEY if present in local .env
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const conn = new Client();

const geminiKey = process.env.GEMINI_API_KEY || "";

const envContent = `NODE_ENV=production
PORT=4001
WEB_URL=http://103.211.200.219:5174
DATABASE_URL=file:/var/database/staging.db?connection_limit=1&busy_timeout=30000
REDIS_URL=redis://127.0.0.1:6379/1
JWT_SECRET=diin-local-dev-secret-0941941049-allow-real-issue
JWT_EXPIRES_IN=30d
DIIN_BASE_URL=https://daily.diin.com.vn
DIIN_USERNAME=0906643381
DIIN_PASSWORD=0906643381@
DIIN_HEADLESS=true
DIIN_ALLOW_ISSUE=true
DIIN_TIMEOUT_MS=45000
DIIN_QUEUE_MODE=bullmq
UPLOAD_DIR=./uploads
PDF_DIR=/var/database/downloads
MAX_UPLOAD_MB=20
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ChangeMe123!
ADMIN_FULL_NAME=Quản trị viên
GEMINI_API_KEY=${geminiKey}
`;

const commands = [
  // 1. Install Redis Server on VPS for BullMQ
  "apt-get update && apt-get install -y redis-server",
  "systemctl start redis-server && systemctl enable redis-server",

  // 2. Create external database folder to prevent code updates from deleting data
  "mkdir -p /var/database/downloads",

  // 3. Stop existing PM2 staging apps
  "pm2 delete diin-api-staging || true",
  "pm2 delete diin-worker-staging || true",
  "pm2 delete diin-web-staging || true",

  // 4. Install pnpm globally
  "npm i -g pnpm",

  // 5. Clone fresh repository code from 'dev' branch for Staging
  "rm -rf /root/auto-cap-don-diin-staging",
  "git clone -b dev https://github.com/QuangPhuocc/auto-cap-don-diin.git /root/auto-cap-don-diin-staging",

  // 6. Write env configurations
  `cat << 'EOF' > /root/auto-cap-don-diin-staging/.env\n${envContent}\nEOF`,
  `cat << 'EOF' > /root/auto-cap-don-diin-staging/apps/api/.env\n${envContent}\nEOF`,
  `cat << 'EOF' > /root/auto-cap-don-diin-staging/apps/web/.env\n${envContent}\nEOF`,

  // 7. Install libraries
  "cd /root/auto-cap-don-diin-staging && pnpm install --no-frozen-lockfile",

  // 7b. Generate Prisma client
  "cd /root/auto-cap-don-diin-staging/apps/api && npx prisma generate",

  // 8. Build the workspaces
  "cd /root/auto-cap-don-diin-staging && pnpm run build",

  // 9. Sync SQLite database (points to /var/database/staging.db)
  "cd /root/auto-cap-don-diin-staging/apps/api && npx prisma db push --accept-data-loss",
  "cd /root/auto-cap-don-diin-staging/apps/api && npx prisma db seed",

  // 10. Playwright browsers and system deps
  "npx playwright install chromium --with-deps",

  // 11. Start applications under PM2 (API, Queue worker and Web UI on port 5174)
  "cd /root/auto-cap-don-diin-staging/apps/api && pm2 start dist/src/server.js --name diin-api-staging",
  "cd /root/auto-cap-don-diin-staging/apps/api && pm2 start dist/src/workers/diin.worker.js --name diin-worker-staging",
  "cd /root/auto-cap-don-diin-staging/apps/web && pm2 start 'npx vite preview --host 0.0.0.0 --port 5174' --name diin-web-staging",

  // 12. Save PM2 state
  "pm2 save",

  // 13. View status
  "pm2 list"
];

conn.on("ready", () => {
  console.log("SSH Connection ready for STAGING deployment...\n");

  let i = 0;
  function runNext() {
    if (i >= commands.length) {
      console.log("\nStaging Deployment completed successfully!");
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
