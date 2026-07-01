import { Router } from "express";
import { JobStatus, PolicyStatus, UserRole } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", asyncHandler(async (req, res) => {
  let policyWhere = {};
  let jobWhere = {};
  let activeUsers: number | undefined = undefined;

  if (req.user!.role === UserRole.CTV) {
    policyWhere = { userId: req.user!.id };
    jobWhere = { userId: req.user!.id };
  } else if (req.user!.role === UserRole.MANAGER) {
    const ctvUsers = await prisma.user.findMany({
      where: { creatorId: req.user!.id },
      select: { id: true }
    });
    const allowedUserIds = [req.user!.id, ...ctvUsers.map(u => u.id)];
    policyWhere = { userId: { in: allowedUserIds } };
    jobWhere = { userId: { in: allowedUserIds } };
    activeUsers = await prisma.user.count({
      where: { creatorId: req.user!.id, status: "ACTIVE" }
    });
  } else {
    // ADMIN
    policyWhere = {};
    jobWhere = {};
    activeUsers = await prisma.user.count({ where: { status: "ACTIVE" } });
  }

  const [totalPolicies, issuedPolicies, failedPolicies, pendingJobs, premium] = await Promise.all([
    prisma.policy.count({ where: policyWhere }),
    prisma.policy.count({ where: { ...policyWhere, status: PolicyStatus.ISSUED } }),
    prisma.policy.count({ where: { ...policyWhere, status: PolicyStatus.FAILED } }),
    prisma.job.count({ where: { ...jobWhere, status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] } } }),
    prisma.policy.aggregate({ where: { ...policyWhere, status: PolicyStatus.ISSUED }, _sum: { premium: true } })
  ]);
  res.json({ totalPolicies, issuedPolicies, failedPolicies, pendingJobs, totalPremium: Number(premium._sum.premium ?? 0), activeUsers });
}));
