import { Router } from "express";
import { JobStatus, PolicyStatus, UserRole } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler.js";
import { prisma } from "../../lib/prisma.js";

export const dashboardRouter = Router();

dashboardRouter.get("/stats", asyncHandler(async (req, res) => {
  const filterType = req.query.filterType === "year" ? "year" : (req.query.filterType === "month" ? "month" : undefined);
  
  // Master account username is 0869200835
  const isMaster = req.user!.username === "0869200835";
  const finalFilterType = filterType || (isMaster ? "year" : "month");

  const now = new Date();
  let dateFilter = {};
  if (finalFilterType === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    dateFilter = {
      createdAt: {
        gte: start,
        lt: end
      }
    };
  } else {
    // year
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear() + 1, 0, 1);
    dateFilter = {
      createdAt: {
        gte: start,
        lt: end
      }
    };
  }

  let policyWhere: any = { ...dateFilter };
  let jobWhere: any = { ...dateFilter };
  let activeUsers: number | undefined = undefined;

  if (req.user!.role === UserRole.CTV) {
    policyWhere = { userId: req.user!.id, ...dateFilter };
    jobWhere = { userId: req.user!.id, ...dateFilter };
  } else if (req.user!.role === UserRole.MANAGER) {
    const ctvUsers = await prisma.user.findMany({
      where: { creatorId: req.user!.id },
      select: { id: true }
    });
    const allowedUserIds = [req.user!.id, ...ctvUsers.map(u => u.id)];
    policyWhere = { userId: { in: allowedUserIds }, ...dateFilter };
    jobWhere = { userId: { in: allowedUserIds }, ...dateFilter };
    activeUsers = await prisma.user.count({
      where: { creatorId: req.user!.id, status: "ACTIVE" }
    });
  } else {
    // ADMIN
    policyWhere = { ...dateFilter };
    jobWhere = { ...dateFilter };
    activeUsers = await prisma.user.count({ where: { status: "ACTIVE" } });
  }

  const [totalPolicies, issuedPolicies, failedPolicies, pendingJobs] = await Promise.all([
    prisma.policy.count({ where: policyWhere }),
    prisma.policy.count({ where: { ...policyWhere, status: PolicyStatus.ISSUED } }),
    prisma.policy.count({ where: { ...policyWhere, status: PolicyStatus.FAILED } }),
    prisma.job.count({ where: { ...jobWhere, status: { in: [JobStatus.QUEUED, JobStatus.PROCESSING] } } })
  ]);

  // Query all issued policies in the filtered range to calculate revenue
  const issuedPoliciesList = await prisma.policy.findMany({
    where: { ...policyWhere, status: PolicyStatus.ISSUED },
    select: { premium: true, passengerCount: true, passengerFee: true }
  });

  let totalRevenue = 0;
  for (const p of issuedPoliciesList) {
    const totalPremium = p.premium ? Number(p.premium) : 0;
    const passengerTotalFee = (p.passengerCount || 0) * (p.passengerFee || 0);
    const premiumTnds = Math.max(0, totalPremium - passengerTotalFee);
    const revenue = (premiumTnds / 1.1) + passengerTotalFee;
    totalRevenue += revenue;
  }

  res.json({ totalPolicies, issuedPolicies, failedPolicies, pendingJobs, totalRevenue, activeUsers });
}));
