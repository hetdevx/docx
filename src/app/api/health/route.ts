import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";

export async function GET() {
  let db: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  const session = await getCurrentUser();

  return Response.json({
    status: "ok",
    db,
    user: session ? { email: session.email, orgRole: session.orgRole } : null,
    timestamp: new Date().toISOString(),
  });
}
