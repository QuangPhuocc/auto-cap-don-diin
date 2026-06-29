import { BatchStatus, JobStatus, PolicyStatus } from "@prisma/client";
import { DiinService } from "../automation/diin.service.js";
import { prisma } from "../lib/prisma.js";
import type { PolicyQueueData } from "../queue/policy.queue.js";

export async function processPolicyJob(data: PolicyQueueData) {
  await prisma.job.update({
    where: { id: data.dbJobId },
    data: { status: JobStatus.PROCESSING, startedAt: new Date(), attempts: { increment: 1 }, progress: 5 }
  });

  const diin = new DiinService();
  try {
    await diin.start();

    if (data.type === "SINGLE_POLICY") {
      const policy = await prisma.policy.update({
        where: { id: data.policyId },
        data: { status: PolicyStatus.PROCESSING }
      });
      const result = await diin.issueSingle(policy);
      await prisma.policy.update({
        where: { id: policy.id },
        data: { ...result, status: PolicyStatus.ISSUED, issuedAt: new Date() }
      });
    } else {
      const batch = await prisma.batchUpload.update({
        where: { id: data.batchId },
        data: { status: BatchStatus.PROCESSING }
      });
      const results = await diin.issueExcel(data.filePath);
      await prisma.$transaction(async (tx) => {
        for (const result of results) {
          await tx.policy.create({
            data: {
              ...result,
              userId: batch.userId,
              batchId: batch.id,
              jobId: data.dbJobId,
              status: PolicyStatus.ISSUED,
              issuedAt: new Date()
            }
          });
        }
        await tx.batchUpload.update({
          where: { id: batch.id },
          data: {
            status: BatchStatus.COMPLETED,
            issuedRows: results.length,
            failedRows: Math.max(0, batch.totalRows - results.length)
          }
        });
      });
    }

    await prisma.job.update({
      where: { id: data.dbJobId },
      data: { status: JobStatus.COMPLETED, progress: 100, completedAt: new Date(), error: null }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.job.update({ where: { id: data.dbJobId }, data: { status: JobStatus.FAILED, error: message } });
    if (data.type === "SINGLE_POLICY") {
      await prisma.policy.update({ where: { id: data.policyId }, data: { status: PolicyStatus.FAILED, error: message } });
    } else {
      await prisma.batchUpload.update({ where: { id: data.batchId }, data: { status: BatchStatus.FAILED } });
    }
    throw error;
  } finally {
    await diin.stop();
  }
}
