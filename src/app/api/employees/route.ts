import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeCache } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '50');
  const search = searchParams.get('search') || '';
  const sortCol = searchParams.get('sortCol') || '';
  const sortDir = searchParams.get('sortDir') || 'asc';
  const filterCol = searchParams.get('filterCol') || '';
  const filterVal = searchParams.get('filterVal') || '';

  const cache = getEmployeeCache();
  if (!cache) {
    return NextResponse.json({ employees: [], total: 0, page, pageSize, totalPages: 0, columns: [] });
  }

  let data = [...cache];
  const columns = data.length > 0 ? Object.keys(data[0]) : [];

  // Search across all columns
  if (search) {
    const q = search.toLowerCase();
    data = data.filter(row => columns.some(col => String(row[col] || '').toLowerCase().includes(q)));
  }

  // Filter by specific column
  if (filterCol && filterVal) {
    data = data.filter(row => String(row[filterCol] || '').toLowerCase().includes(filterVal.toLowerCase()));
  }

  // Sort
  if (sortCol && columns.includes(sortCol)) {
    data.sort((a, b) => {
      const va = String(a[sortCol] || '');
      const vb = String(b[sortCol] || '');
      return sortDir === 'asc' ? va.localeCompare(vb, 'ru') : vb.localeCompare(va, 'ru');
    });
  }

  const total = data.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const employees = data.slice(start, start + pageSize);

  return NextResponse.json({ employees, total, page, pageSize, totalPages, columns });
}