import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/require-user";

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, email: true, name: true, orgRole: true, createdAt: true },
    });
    return Response.json({ users });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(err);
    return Response.json({ error: "Failed to list users" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = await request.json().catch(() => null);
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const orgRole = ["admin", "editor", "viewer"].includes(body?.orgRole) ? body.orgRole : "viewer";

    if (!email || !name) {
      return Response.json({ error: "email and name are required" }, { status: 400 });
    }

    const tempPassword = randomBytes(9).toString("base64url");
    const passwordHash = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: { email, name, orgRole, passwordHash },
    });

    return Response.json(
      {
        user: { id: user.id, email: user.email, name: user.name, orgRole: user.orgRole },
        tempPassword,
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "P2002"
    ) {
      return Response.json({ error: "A user with that email already exists" }, { status: 409 });
    }
    console.error(err);
    return Response.json({ error: "Failed to create user" }, { status: 500 });
  }
}
