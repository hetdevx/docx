import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { LogoutButton } from "./logout-button";

export async function Nav() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/documents" className="font-semibold text-sm text-zinc-950 dark:text-zinc-50">
          DocVault
        </Link>
        <Link href="/documents" className="text-sm text-zinc-600 dark:text-zinc-400">
          Documents
        </Link>
        <Link href="/upload" className="text-sm text-zinc-600 dark:text-zinc-400">
          Upload
        </Link>
        <Link href="/search" className="text-sm text-zinc-600 dark:text-zinc-400">
          Search
        </Link>
        {user.orgRole === "admin" && (
          <Link href="/admin/users" className="text-sm text-zinc-600 dark:text-zinc-400">
            Admin
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-zinc-500">{user.email}</span>
        <LogoutButton />
      </div>
    </nav>
  );
}
