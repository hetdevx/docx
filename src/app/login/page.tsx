"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FileLock2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Login failed");
      return;
    }

    router.push("/documents");
    router.refresh();
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-gradient-to-b from-accent-soft/40 to-background px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="flex justify-center mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FileLock2 className="h-5 w-5" />
          </div>
        </div>
        <h1 className="text-xl font-semibold mb-1 text-center text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-zinc-500 mb-6 text-center">Sign in to continue to DocVault</p>

        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
            Email
          </label>
          <Input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-4"
          />

          <label className="block text-sm font-medium mb-1 text-zinc-700 dark:text-zinc-300">
            Password
          </label>
          <Input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-4"
          />

          {error && (
            <p className="mb-4 text-sm text-red-600 dark:text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-accent hover:text-accent-hover">
            Sign up
          </Link>
        </p>
      </Card>
    </main>
  );
}
