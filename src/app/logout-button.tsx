"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
    >
      Log out
    </button>
  );
}
