import { Router } from "express";
import { UserRole } from "@prisma/client";
import { asyncHandler } from "../../lib/async-handler.js";
import { AppError, assertFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

export const jobRouter = Router();

jobRouter.get("/", asyncHandler(async (req, res) => {
  const where = req.user!.role === UserRole.CTV ? { userId: req.user!.id } : {};
  const items = await prisma.job.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { batch: true, policies: { select: { id: true, plateNumber: true, status: true, certificateNumber: true } } } });
  res.json({ items });
}));

jobRouter.get("/:id", asyncHandler(async (req, res) => {
  const id = String(req.params.id);
  const job = assertFound(await prisma.job.findUnique({ where: { id }, include: { batch: true, policies: true } }));
  if (req.user!.role === UserRole.CTV && job.userId !== req.user!.id) throw new AppError(403, "Bạn không có quyền xem job này");
  res.json(job);
}));
