import { Queue } from "bullmq";
import { env } from "../config/env.js";
import { redis } from "../lib/redis.js";

export const POLICY_QUEUE = `diin-policy-${env.PORT}`;

/** Chỉ còn SINGLE_POLICY — đã loại bỏ Excel upload */
export type PolicyQueueData = { type: "SINGLE_POLICY"; dbJobId: string; policyId: string };

export const policyQueue = env.DIIN_QUEUE_MODE === "bullmq"
  ? new Queue<PolicyQueueData, void, string>(POLICY_QUEUE, {
      connection: redis!,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 500,
        removeOnFail: 1000
      }
    })
  : null;

export async function enqueuePolicyJob(data: PolicyQueueData) {
  if (env.DIIN_QUEUE_MODE === "sync") {
    setImmediate(async () => {
      try {
        const { processPolicyJob } = await import("../workers/process-job.js");
        await processPolicyJob(data);
      } catch (error) {
        console.error("DIIN sync job failed:", error);
      }
    });
    return { id: data.dbJobId };
  }

  if (!policyQueue) throw new Error("BullMQ queue is not initialized");
  return policyQueue.add(data.type, data, { jobId: data.dbJobId });
}
