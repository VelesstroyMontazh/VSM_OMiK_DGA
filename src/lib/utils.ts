import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Company detection by tab number prefix
const COMPANY_MAP: Record<string, string> = {
  'ВСМ': 'ВелесстройМонтаж', 'ВМ': 'ВелесстройМонтаж',
  'ВС': 'Велесстрой', 'ВУ': 'Велесстрой-СМУ',
  'ГК': 'ГКК', 'СА': 'СМК', 'МВ': 'Стройконстракшен',
};

export function getCompanyByTabNumber(tabNumber: string): string {
  if (!tabNumber) return 'Неизвестно';
  const upper = tabNumber.toUpperCase().trim();
  for (const [prefix, company] of Object.entries(COMPANY_MAP)) {
    if (upper.startsWith(prefix)) return company;
  }
  return 'ВелесстройМонтаж';
}

// Check if employee is active (no dismissal date or date in future)
export function isEmployeeActive(dismissalDate: string): boolean {
  if (!dismissalDate) return true;
  const d = parseDDMMYYYY(dismissalDate);
  if (!d) return true;
  return d > new Date();
}

// Parse DD.MM.YYYY date string
export function parseDDMMYYYY(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('.');
  if (parts.length !== 3) {
    // Try ISO format
    const iso = Date.parse(dateStr);
    if (!isNaN(iso)) return new Date(iso);
    return null;
  }
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

// Format date to DD.MM.YYYY
export function formatDateDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

// Format number with spaces as thousands separator
export function formatNumber(n: number): string {
  return n.toLocaleString('ru-RU');
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}