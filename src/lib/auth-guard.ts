import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

export type AuthSession = {
  user?: {
    name?: string | null;
    email?: string | null;
    role?: string;
  };
};

export async function getAuthSession(): Promise<AuthSession | null> {
  return getServerSession(authOptions);
}

export async function requireAdmin(): Promise<
  | { session: AuthSession; error: null }
  | { session: null; error: NextResponse }
> {
  const session = await getAuthSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session?.user || role !== "admin") {
    return {
      session: null,
      error: NextResponse.json({ error: "Требуются права администратора" }, { status: 403 }),
    };
  }
  return { session, error: null };
}
