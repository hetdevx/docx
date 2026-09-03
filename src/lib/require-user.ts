import { getCurrentUser, type SessionPayload } from "@/lib/session";

export class UnauthorizedError extends Error {}
export class ForbiddenError extends Error {}

export async function requireUser(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError("Not authenticated");
  return user;
}

export async function requireAdmin(): Promise<SessionPayload> {
  const user = await requireUser();
  if (user.orgRole !== "admin") throw new ForbiddenError("Admin only");
  return user;
}
