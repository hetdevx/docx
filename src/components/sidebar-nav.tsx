"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileStack, Search, ShieldCheck, UploadCloud } from "lucide-react";
import type { LucideIcon } from "lucide-react";

const links: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/search", label: "Search", icon: Search },
];

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = isAdmin
    ? [...links, { href: "/admin/users", label: "Admin", icon: ShieldCheck }]
    : links;

  return (
    <nav className="flex flex-col gap-1">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname?.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
