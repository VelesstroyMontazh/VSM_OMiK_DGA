import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAdmin } from "@/lib/auth-guard";
import { db, withRetry } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/users — список пользователей (admin).
 */
export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const users = await withRetry(() =>
      db.user.findMany({
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          workspace: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
        },
        orderBy: { username: "asc" },
      }),
    );
    return NextResponse.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/admin/users — создать пользователя (admin).
 * Body: { username, password, displayName?, role?, workspace? }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
      role?: string;
      workspace?: string;
    };

    const username = body.username?.trim();
    const password = body.password?.trim();
    if (!username || !password) {
      return NextResponse.json(
        { error: "Укажите username и password" },
        { status: 400 },
      );
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Пароль не менее 6 символов" },
        { status: 400 },
      );
    }

    const existing = await withRetry(() =>
      db.user.findUnique({ where: { username } }),
    );
    if (existing) {
      return NextResponse.json({ error: "Пользователь уже существует" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await withRetry(() =>
      db.user.create({
        data: {
          username,
          passwordHash,
          displayName: body.displayName?.trim() || username,
          role: body.role === "admin" ? "admin" : "user",
          workspace: body.workspace?.trim() || "default",
        },
        select: {
          id: true,
          username: true,
          displayName: true,
          role: true,
          workspace: true,
          isActive: true,
        },
      }),
    );

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
