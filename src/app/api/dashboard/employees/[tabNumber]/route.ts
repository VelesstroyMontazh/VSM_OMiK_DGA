import { NextResponse } from "next/server";
import { fetchEmployeeProfile } from "@/lib/employee-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ tabNumber: string }>;
};

/**
 * GET /api/dashboard/employees/[tabNumber]
 * Единый профиль: dim + явка + HR + KPI + билеты + рейсы + визы.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { tabNumber: raw } = await context.params;
    const tabNumber = decodeURIComponent(raw).trim();
    if (!tabNumber) {
      return NextResponse.json({ error: "tabNumber не указан" }, { status: 400 });
    }

    const profile = fetchEmployeeProfile(tabNumber);
    if (!profile) {
      return NextResponse.json(
        { error: `Сотрудник «${tabNumber}» не найден` },
        { status: 404 },
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboard/employees/profile]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
