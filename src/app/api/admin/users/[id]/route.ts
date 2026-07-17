import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth-guard";
import { db, withRetry } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/users/[id]
 * Body: { displayName?, role?, isActive?, password? }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      displayName?: string;
      role?: string;
      isActive?: boolean;
      password?: string;
    };

    const data: {
      displayName?: string;
      role?: string;
      isActive?: boolean;
      passwordHash?: string;
    } = {};

    if (body.displayName !== undefined) data.displayName = body.displayName.trim();
    if (body.role !== undefined) data.role = body.role === "admin" ? "admin" : "user";
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.password?.trim()) {
      if (body.password.trim().length < 6) {
        return NextResponse.json({ error: "Пароль не менее 6 символов" }, { status: 400 });
      }
      data.passwordHash = await bcrypt.hash(body.password.trim(), 10);
    }

    const user = await withRetry(() =>
      db.user.update({
        where: { id },
        data,
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
        },
      }),
    );

    return NextResponse.json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await context.params;
    await withRetry(() => db.user.delete({ where: { id } }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
