import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/password";

const ADMIN_EMAIL = "admin@docvault.local";
const ADMIN_PASSWORD = "changeme123";

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash },
    create: {
      email: ADMIN_EMAIL,
      name: "Admin",
      orgRole: "admin",
      passwordHash,
    },
  });

  console.log("Seeded admin user:", { email: admin.email, orgRole: admin.orgRole });
  console.log(`Login with ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
