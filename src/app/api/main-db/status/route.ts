import { NextResponse } from 'next/server';
import { getEmployeeCache, getEmployeeCacheMeta, db, withRetry } from '@/lib/db';

export async function GET() {
  const cache = getEmployeeCache();
  const meta = getEmployeeCacheMeta();
  const activeFile = cache ? await withRetry(() => db.excelFile.findFirst({ where: { isActive: true, category: 'base' } })).catch(() => null) : null;
  return NextResponse.json({
    loaded: !!cache,
    rows: meta.rows,
    cols: meta.cols,
    fileName: meta.fileName,
    loadedAt: meta.loadedAt,
    activeFileId: activeFile?.id,
  });
}