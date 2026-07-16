import { NextRequest, NextResponse } from 'next/server';
import { db, withRetry, setEmployeeCache, clearEmployeeCache } from '@/lib/db';
import * as XLSX from 'xlsx';
import { readFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileId } = body;
    if (!fileId) return NextResponse.json({ error: 'fileId required' }, { status: 400 });

    const file = await withRetry(() => db.excelFile.findUnique({ where: { id: fileId } }));
    if (!file) return NextResponse.json({ error: 'File not found' }, { status: 404 });

    const buffer = await readFile(file.filePath);
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

    setEmployeeCache(data, { rows: data.length, cols: data.length > 0 ? Object.keys(data[0]).length : 0, fileName: file.originalName });

    // Mark as active, deactivate others
    await withRetry(() => db.excelFile.updateMany({ where: { category: 'base' }, data: { isActive: false } }));
    await withRetry(() => db.excelFile.update({ where: { id: fileId }, data: { isActive: true, status: 'processed' } }));

    return NextResponse.json({ success: true, rows: data.length, columns: data.length > 0 ? Object.keys(data[0]).length : 0, fileName: file.originalName });
  } catch (error) {
    console.error('Load base error:', error);
    return NextResponse.json({ error: 'Failed to load base' }, { status: 500 });
  }
}