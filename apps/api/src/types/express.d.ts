import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; username: string; fullName: string; role: UserRole };
    }
  }
}

export {};
