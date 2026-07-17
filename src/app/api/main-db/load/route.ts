import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "fs";
import { readFile } from "fs/promises";
import * as XLSX from "xlsx";
import {
  clearEmployeeCache,
  db,
  setEmployeeCache,
  withRetry,
} from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExcelFileRow = {
  id: string;
  filePath: string;
  originalName: string;
  category: string;
};

/**
 * POST /api/main-db/load
 * Body: { fileId: string }
 * Читает Excel с диска, кладёт в in-memory cache, помечает файл isActive.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { fileId?: string };
    const fileId = body.fileId?.trim();
    if (!fileId) {
      return NextResponse.json({ error: "Укажите fileId" }, { status: 400 });
    }

    const file = (await withRetry(() =>
      db.excelFile.findUnique({ where: { id: fileId } }),
    )) as ExcelFileRow | null;

    if (!file) {
      return NextResponse.json({ error: "Файл не найден в БД" }, { status: 404 });
    }
    if (!file.filePath || !existsSync(file.filePath)) {
      return NextResponse.json(
        {
          error: `Файл на диске не найден: ${file.filePath || "(путь пуст)"}. Загрузите Excel заново.`,
        },
        { status: 404 },
      );
    }

    const buffer = await readFile(file.filePath);
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    if (!wb.SheetNames.length) {
      return NextResponse.json({ error: "В Excel нет листов" }, { status: 400 });
    }

    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    if (data.length === 0) {
      clearEmployeeCache();
      return NextResponse.json(
        { error: "Excel пустой — нет строк для активации" },
        { status: 400 },
      );
    }

    setEmployeeCache(data, {
      rows: data.length,
      cols: Object.keys(data[0]).length,
      fileName: file.originalName,
    });

    await withRetry(() =>
      db.excelFile.updateMany({
        where: { category: "base" },
        data: { isActive: false },
      }),
    );
    await withRetry(() =>
      db.excelFile.update({
        where: { id: fileId },
        data: { isActive: true, status: "processed", totalRows: data.length },
      }),
    );

    return NextResponse.json({
      success: true,
      rows: data.length,
      columns: Object.keys(data[0]).length,
      fileName: file.originalName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[main-db/load]", message);
    return NextResponse.json(
      { error: `Не удалось загрузить базу: ${message}` },
      { status: 500 },
    );
  }
}
