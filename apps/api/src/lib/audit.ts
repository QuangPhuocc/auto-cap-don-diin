import type { Request } from "express";
import { prisma } from "./prisma.js";

export async function audit(req: Request, action: string, details?: unknown) {
  await prisma.auditLog.create({
    data: {
      userId: req.user?.id,
      action,
      details: details as object | undefined,
      ipAddress: req.ip
    }
  });
}
