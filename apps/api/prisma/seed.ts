import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = "0869200835";
  const passwordHash = await bcrypt.hash("0869200835@", 12);
  await prisma.user.upsert({
    where: { username },
    update: {
      fullName: "Master",
      phone: "0869200835",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE
    },
    create: {
      username,
      passwordHash,
      fullName: "Master",
      phone: "0869200835",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE
    }
  });
  console.log(`Seeded admin: ${username}`);
}

main().finally(() => prisma.$disconnect());
