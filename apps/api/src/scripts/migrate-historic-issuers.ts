import { prisma } from "../lib/prisma.js";

function normalizeName(name: string): string {
  if (!name) return "";
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toUpperCase()
    .trim();
}

async function main() {
  console.log("=== BẮT ĐẦU MIGRATION DỮ LIỆU LỊCH SỬ ===");

  const users = await prisma.user.findMany();
  console.log(`Đã load ${users.length} tài khoản người dùng.`);

  const policies = await prisma.policy.findMany();
  console.log(`Tìm thấy ${policies.length} đơn hàng cũ chưa có revenueUserId.`);

  let updatedCount = 0;
  let selfAssignedCount = 0;

  for (const policy of policies) {
    const issuer = policy.issuerName || "";
    const normIssuer = normalizeName(issuer);

    let matchedUser = null;
    if (normIssuer) {
      // Tìm user khớp tên
      matchedUser = users.find(u => {
        const normFullName = normalizeName(u.fullName || "");
        return normFullName.includes(normIssuer) || normIssuer.includes(normFullName);
      });
    }

    const targetUserId = matchedUser ? matchedUser.id : policy.userId;
    
    await prisma.policy.update({
      where: { id: policy.id },
      data: { revenueUserId: targetUserId }
    });

    if (matchedUser) {
      console.log(`Đơn ${policy.id} (${policy.plateNumber}): Gán doanh thu cho ${matchedUser.fullName} (Khớp tên từ "${issuer}")`);
      updatedCount++;
    } else {
      console.log(`Đơn ${policy.id} (${policy.plateNumber}): Mặc định tính cho người tạo (Không khớp tên từ "${issuer}")`);
      selfAssignedCount++;
    }
  }

  console.log("=== MIGRATION HOÀN TẤT ===");
  console.log(`- Đã cập nhật chuyển doanh thu: ${updatedCount} đơn.`);
  console.log(`- Đã gán mặc định cho người tạo: ${selfAssignedCount} đơn.`);
}

main()
  .catch(err => {
    console.error("Lỗi Migration:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
