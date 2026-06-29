import "dotenv/config";
import { Worker, type Job as BullJob } from "bullmq";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";
import { POLICY_QUEUE, type PolicyQueueData } from "../queue/policy.queue.js";
import { processPolicyJob } from "./process-job.js";

async function processJob(bullJob: BullJob<PolicyQueueData>) {
  await processPolicyJob(bullJob.data);
}

if (!redis) throw new Error("Redis is required when running the BullMQ worker. Set DIIN_QUEUE_MODE=bullmq.");
const redisConnection = redis;

const worker = new Worker<PolicyQueueData, void, string>(POLICY_QUEUE, processJob, { connection: redisConnection, concurrency: 1 });
worker.on("completed", (job) => console.log(`DIIN job ${job.id} completed`));
worker.on("failed", (job, error) => console.error(`DIIN job ${job?.id} failed:`, error.message));

async function shutdown() { await worker.close(); await redisConnection.quit(); await prisma.$disconnect(); process.exit(0); }
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
