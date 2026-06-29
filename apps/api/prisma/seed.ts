import bcrypt from "bcryptjs";
import { PrismaClient, UserRole, UserStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { username },
    update: { fullName: process.env.ADMIN_FULL_NAME ?? "Quản trị viên", role: UserRole.ADMIN, status: UserStatus.ACTIVE },
    create: { username, passwordHash, fullName: process.env.ADMIN_FULL_NAME ?? "Quản trị viên", role: UserRole.ADMIN }
  });
  console.log(`Seeded admin: ${username}`);

  const ctvPasswordHash = await bcrypt.hash("0941941049@", 12);
  await prisma.user.upsert({
    where: { username: "0941941049" },
    update: {
      passwordHash: ctvPasswordHash,
      fullName: "CTV 0941941049",
      role: UserRole.CTV,
      status: UserStatus.ACTIVE
    },
    create: {
      username: "0941941049",
      passwordHash: ctvPasswordHash,
      fullName: "CTV 0941941049",
      role: UserRole.CTV,
      status: UserStatus.ACTIVE
    }
  });
  console.log("Seeded CTV: 0941941049");
}

main().finally(() => prisma.$disconnect());
