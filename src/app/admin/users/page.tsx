import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-user";
import { UsersTable } from "./users-table";

export default async function AdminUsersPage() {
  await requireAdmin();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, name: true, orgRole: true, createdAt: true },
  });

  return (
    <main className="flex-1 px-6 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50 mb-6">
        Users
      </h1>
      <UsersTable initialUsers={users} />
    </main>
  );
}
