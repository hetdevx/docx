import { prisma } from "@/lib/prisma";
import { requireAdmin, UnauthorizedError, ForbiddenError } from "@/lib/require-user";

export async function PATCH(
  request: Request,
  { params }: RouteContext<"/api/admin/users/[id]">,
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!["admin", "editor", "viewer"].includes(body?.orgRole)) {
      return Response.json({ error: "Invalid orgRole" }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id },
      data: { orgRole: body.orgRole },
      select: { id: true, email: true, name: true, orgRole: true },
    });

    return Response.json({ user });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error(err);
    return Response.json({ error: "Failed to update user" }, { status: 500 });
  }
}
