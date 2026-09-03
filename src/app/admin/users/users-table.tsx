"use client";

import { useState } from "react";

type OrgRole = "admin" | "editor" | "viewer";
type UserRow = { id: string; email: string; name: string; orgRole: OrgRole; createdAt: Date };

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
      <form
        onSubmit={handleCreate}
        className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 space-y-3"
      >
        <h2 className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
          Add a user
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm"
          />
          <select
            value={orgRole}
            onChange={(e) => setOrgRole(e.target.value as OrgRole)}
            className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5 text-sm"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button
            type="submit"
            disabled={busy || !email.trim() || !name.trim()}
            className="rounded bg-zinc-950 dark:bg-zinc-50 text-zinc-50 dark:text-zinc-950 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            Add
          </button>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {tempPassword && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            User created. Temporary password: <code>{tempPassword}</code> — share this
            with them securely; it won&apos;t be shown again.
          </p>
        )}
      </form>

      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-lg">
        {users.map((u) => (
          <li key={u.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
                {u.name}
              </p>
              <p className="text-xs text-zinc-500">{u.email}</p>
            </div>
            <select
              value={u.orgRole}
              disabled={busy}
              onChange={(e) => handleRoleChange(u.id, e.target.value as OrgRole)}
              className="rounded border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1 text-sm"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}
