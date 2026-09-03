import { FileLock2 } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SidebarNav } from "@/components/sidebar-nav";
import { LogoutButton } from "./logout-button";

export async function Sidebar() {
  const user = await getCurrentUser();
  if (!user) return null;

  const profile = await prisma.user.findUnique({
    where: { email: user.email },
    select: { name: true },
  });
  const displayName = profile?.name?.trim() || user.email;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface px-3 py-4">
      <div className="flex items-center gap-2 px-2 pb-6">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <FileLock2 className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold text-foreground">DocVault</span>
      </div>

      <SidebarNav isAdmin={user.orgRole === "admin"} />

      <div className="mt-auto flex items-center gap-2.5 rounded-lg px-2 py-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{displayName}</p>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
