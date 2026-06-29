import { Router } from "express";
import { JobStatus, PolicyStatus, UserRole } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", asyncHandler(async (req, res) => {
  const policyWhere = req.user!.role === UserRole.CTV ? { userId: req.user!.id } : {};
  const jobWhere = req.user!.role === UserRole.CTV ? { userId: req.user!.id } : {};
  const [totalPolicies, issuedPolicies, failedPolicies, pendingJobs, premium, activeUsers] = await Promise.all([
    prisma.policy.count({ where: policyWhere }),
    prisma.policy.count({ where: { ...policyWhere, status: PolicyStatus.ISSUED } }),
    prisma.policy.count({ where: { ...policyWhere, status: PolicyStatus.FAILED } }),
    prisma.job.count({ where: { ...jobWhere, status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] } } }),
    prisma.policy.aggregate({ where: { ...policyWhere, status: PolicyStatus.ISSUED }, _sum: { premium: true } }),
    req.user!.role !== UserRole.CTV ? prisma.user.count({ where: { status: "ACTIVE" } }) : Promise.resolve(undefined)
  ]);
  res.json({ totalPolicies, issuedPolicies, failedPolicies, pendingJobs, totalPremium: Number(premium._sum.premium ?? 0), activeUsers });
}));
