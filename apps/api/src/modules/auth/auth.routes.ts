import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UserStatus } from "@prisma/client";
import { z } from "zod";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { audit } from "../../lib/audit.js";
import { AppError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/auth.js";

export const authRouter = Router();
const loginSchema = z.object({ username: z.string().min(3).max(100), password: z.string().min(6).max(200) });

authRouter.post("/login", asyncHandler(async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { username: input.username } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) throw new AppError(401, "Sai tài khoản hoặc mật khẩu", "INVALID_CREDENTIALS");
  if (user.status !== UserStatus.ACTIVE) throw new AppError(403, "Tài khoản đã bị khóa hoặc ngừng hoạt động", "ACCOUNT_DISABLED");
  const token = jwt.sign({ username: user.username, fullName: user.fullName, role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]
  });
  req.user = { id: user.id, username: user.username, fullName: user.fullName, role: user.role };
  await audit(req, "AUTH_LOGIN");
  res.json({ token, user: req.user });
}));

authRouter.get("/me", authenticate, asyncHandler(async (req, res) => res.json({ user: req.user })));
