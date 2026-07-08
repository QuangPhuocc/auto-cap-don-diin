import "dotenv/config";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { redis } from "./lib/redis.js";
import { startCleanupCron } from "./lib/cleanup.js";

const server = app.listen(env.PORT, () => {
  console.log(`DIIN API listening on http://localhost:${env.PORT}`);
  startCleanupCron();
});

async function shutdown() {
  server.close();
  await redis?.quit();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
