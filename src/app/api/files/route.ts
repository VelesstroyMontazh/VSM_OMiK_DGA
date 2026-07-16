import { NextRequest, NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

const UPLOAD_DIR = path.join(process.cwd(), 'upload');

const CATEGORIES = [
  { id: 'base', label: 'БАЗА (1С)', description: 'Основная база сотрудников из 1С' },
  { id: 'daily', label: 'Ежедневный учёт', description: 'Ежедневный учёт персонала' },
  { id: 'hire', label: 'Приём', description: 'Кадровые события — приём на работу' },
  { id: 'transfer', label: 'Перевод', description: 'Кадровые события — переводы' },
  { id: 'fire', label: 'Увольнение', description: 'Кадровые события — увольнения' },
  { id: 'reference', label: 'Справочники', description: 'Классификация, площадки, подразделения' },
  { id: 'evaluations', label: 'Оценки', description: 'Полугодовые оценки сотрудников' },
  { id: 'flights', label: 'Прилёт-Вылет', description: 'Календарь прилёта-вылета' },
  { id: 'general', label: 'Общие', description: 'Прочие файлы' },
];

export async function GET() {
  try {
    const files = await withRetry(() => db.excelFile.findMany({ orderBy: { loadedAt: 'desc' } }));
    return NextResponse.json({ files, categories: CATEGORIES });
  } catch (error) {
    console.error('Files list error:', error);
    return NextResponse.json({ error: 'Failed to list files' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, fileData, category } = body;
    if (!fileName || !fileData || !category) {
      return NextResponse.json({ error: 'Missing required fields: fileName, fileData, category' }, { status: 400 });
    }

    const buffer = Buffer.from(fileData, 'base64');
    const catDir = path.join(UPLOAD_DIR, category);
    if (!existsSync(catDir)) await mkdir(catDir, { recursive: true });
    const safeName = fileName.replace(/[^a-zA-Zа-яА-Я0-9._-]/g, '_');
    const filePath = path.join(catDir, safeName);
    await writeFile(filePath, buffer);

    let totalRows = 0, totalCols = 0, sheetName = 'Лист1';
    try {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      sheetName = wb.SheetNames[0] || 'Лист1';
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      totalRows = json.length;
      totalCols = json.length > 0 ? Object.keys(json[0]).length : 0;
    } catch (e) {
      console.error('Excel parse error:', e);
    }

    const file = await withRetry(() => db.excelFile.create({
      data: {
        name: safeName,
        originalName: fileName,
        filePath,
        fileSize: buffer.length,
        sheetName,
        totalRows,
        totalCols,
        category,
        status: 'processed',
        isActive: false,
      },
    }));

    return NextResponse.json({ success: true, file });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}