import { Router } from "express";
import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { audit } from "../../lib/audit.js";
import { AppError, assertFound } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { authorize } from "../../middleware/auth.js";

export const userRouter = Router();

userRouter.patch("/profile", asyncHandler(async (req, res) => {
  const profileSchema = z.object({
    fullName: z.string().min(2).max(255).optional(),
    phone: z.string().max(20).optional().nullable()
  });
  const input = profileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: input,
    select: { id: true, username: true, fullName: true, phone: true, role: true, status: true, createdAt: true }
  });
  res.json(user);
}));

userRouter.use(authorize(UserRole.ADMIN, UserRole.MANAGER));

const createSchema = z.object({
  username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200),
  fullName: z.string().min(2).max(255),
  phone: z.string().max(20).optional().nullable(),
  role: z.nativeEnum(UserRole).default(UserRole.CTV)
});
const updateSchema = z.object({
  username: z.string().min(3).max(100).regex(/^[a-zA-Z0-9._-]+$/).optional(),
  fullName: z.string().min(2).max(255).optional(),
  phone: z.string().max(20).optional().nullable(),
  password: z.string().min(8).max(200).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(UserRole).optional()
});

userRouter.get("/", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const q = String(req.query.q ?? "");
  const where = q ? { OR: [{ username: { contains: q } }, { fullName: { contains: q } }] } : {};
  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, select: { id: true, username: true, fullName: true, phone: true, role: true, status: true, createdAt: true }, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.user.count({ where })
  ]);

  const userIds = items.map((u) => u.id);
  const [policyCounts, premiumSums] = await Promise.all([
    prisma.policy.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "ISSUED" },
      _count: true
    }),
    prisma.policy.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds }, status: "ISSUED" },
      _sum: { premium: true }
    })
  ]);

  const statsMap = new Map(userIds.map((id) => [id, { count: 0, premium: 0 }]));
  for (const item of policyCounts) {
    if (item.userId) {
      const stat = statsMap.get(item.userId) || { count: 0, premium: 0 };
      stat.count = item._count;
      statsMap.set(item.userId, stat);
    }
  }
  for (const item of premiumSums) {
    if (item.userId) {
      const stat = statsMap.get(item.userId) || { count: 0, premium: 0 };
      stat.premium = Number(item._sum.premium ?? 0);
      statsMap.set(item.userId, stat);
    }
  }

  const itemsWithStats = items.map((u) => ({
    ...u,
    stats: statsMap.get(u.id) || { count: 0, premium: 0 }
  }));

  res.json({ items: itemsWithStats, total, page, limit });
}));

userRouter.post("/", asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  if (req.user!.role === UserRole.MANAGER && input.role === UserRole.ADMIN) {
    throw new AppError(403, "Quản lý không được phép tạo tài khoản Admin");
  }
  if (await prisma.user.findUnique({ where: { username: input.username } })) throw new AppError(409, "Tên đăng nhập đã tồn tại", "USERNAME_EXISTS");
  const { password, ...profile } = input;
  const user = await prisma.user.create({ data: { ...profile, passwordHash: await bcrypt.hash(password, 12) }, select: { id: true, username: true, fullName: true, phone: true, role: true, status: true, createdAt: true } });
  await audit(req, "CTV_CREATE", { targetUserId: user.id, username: user.username });
  res.status(201).json(user);
}));

userRouter.patch("/:id", asyncHandler(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const id = String(req.params.id);
  const targetUser = assertFound(await prisma.user.findUnique({ where: { id } }), "Không tìm thấy CTV");
  if (req.user!.role === UserRole.MANAGER && (targetUser.role === UserRole.ADMIN || input.role === UserRole.ADMIN)) {
    throw new AppError(403, "Quản lý không được phép chỉnh sửa hoặc cấp quyền Admin");
  }
  if (id === req.user!.id && input.status && input.status !== UserStatus.ACTIVE) throw new AppError(400, "Không thể tự khóa tài khoản đang đăng nhập");
  
  if (input.username && input.username !== targetUser.username) {
    const existing = await prisma.user.findUnique({ where: { username: input.username } });
    if (existing) throw new AppError(409, "Tên đăng nhập đã tồn tại", "USERNAME_EXISTS");
  }

  const { password, ...data } = input;
  const user = await prisma.user.update({ where: { id }, data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}) }, select: { id: true, username: true, fullName: true, phone: true, role: true, status: true, createdAt: true } });
  await audit(req, "CTV_UPDATE", { targetUserId: user.id, changes: Object.keys(input) });
  res.json(user);
}));
