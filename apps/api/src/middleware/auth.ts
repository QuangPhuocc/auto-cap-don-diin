import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../lib/errors.js";

export type TokenPayload = { sub: string; username: string; fullName: string; role: UserRole };

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  if (!token) return next(new AppError(401, "Vui lòng đăng nhập", "UNAUTHORIZED"));
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
    req.user = { id: payload.sub, username: payload.username, fullName: payload.fullName, role: payload.role };
    next();
  } catch {
    next(new AppError(401, "Phiên đăng nhập không hợp lệ hoặc đã hết hạn", "INVALID_TOKEN"));
  }
}

export const authorize = (...roles: UserRole[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user || !roles.includes(req.user.role)) return next(new AppError(403, "Bạn không có quyền thực hiện", "FORBIDDEN"));
  next();
};
