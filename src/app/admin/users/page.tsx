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
    <main className="flex-1 px-8 py-8 max-w-2xl mx-auto w-full">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Users
      </h1>
      <p className="text-sm text-zinc-500 mb-6">
        Manage who has access to DocVault and their org-wide role.
      </p>
      <UsersTable initialUsers={users} />
    </main>
  );
}
