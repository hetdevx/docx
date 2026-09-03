"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type OrgRole = "admin" | "editor" | "viewer";
type UserRow = { id: string; email: string; name: string; orgRole: OrgRole; createdAt: Date };

const ROLE_STYLES: Record<OrgRole, string> = {
  admin: "bg-accent-soft text-accent",
  editor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  viewer: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export function UsersTable({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [orgRole, setOrgRole] = useState<OrgRole>("viewer");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setTempPassword(null);

    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, orgRole }),
    });

    setBusy(false);
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(data.error ?? "Failed to create user");
      return;
    }

    setUsers((prev) => [...prev, { ...data.user, createdAt: new Date() }]);
    setTempPassword(data.tempPassword);
    setEmail("");
    setName("");
    setOrgRole("viewer");
  }

  async function handleRoleChange(id: string, newRole: OrgRole) {
    setBusy(true);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgRole: newRole }),
    });
    setBusy(false);
    if (res.ok) {
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, orgRole: newRole } : u)));
    }
  }

  return (
    <div className="space-y-8">
      <Card className="p-4 space-y-3">
        <h2 className="text-sm font-medium text-foreground">
          Add a user
        </h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <Input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1"
          />
          <Select
            value={orgRole}
            onChange={(e) => setOrgRole(e.target.value as OrgRole)}
            className="w-auto"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </Select>
          <Button type="submit" disabled={busy || !email.trim() || !name.trim()}>
            Add
          </Button>
        </form>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {tempPassword && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            User created. Temporary password: <code>{tempPassword}</code> — share this
            with them securely; it won&apos;t be shown again.
          </p>
        )}
      </Card>

      <Card className="divide-y divide-border-subtle overflow-hidden">
        {users.map((u) => (
          <div key={u.id} className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                {u.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {u.name}
                </p>
                <p className="text-xs text-zinc-500 truncate">{u.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_STYLES[u.orgRole]}`}>
                {u.orgRole}
              </span>
              <Select
                value={u.orgRole}
                disabled={busy}
                onChange={(e) => handleRoleChange(u.id, e.target.value as OrgRole)}
                className="w-auto py-1 text-xs"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
