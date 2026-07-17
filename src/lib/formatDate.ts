/**
 * Единое форматирование дат для API и UI.
 * ISO YYYY-MM-DD ↔ ДД.ММ.ГГГГ
 */

const DDMMYYYY_RE = /^(\d{2})\.(\d{2})\.(\d{4})$/;
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})/;

/** ISO YYYY-MM-DD → ДД.ММ.ГГГГ */
export function formatDateToDDMMYYYY(
  dateString: string | null | undefined,
): string | null {
  if (!dateString) return null;
  const trimmed = dateString.trim();
  const iso = trimmed.match(ISO_DATE_RE);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  if (DDMMYYYY_RE.test(trimmed)) return trimmed;
  return trimmed;
}

/** ДД.ММ.ГГГГ → YYYY-MM-DD (для SQL и input[type=date]) */
export function parseDDMMYYYYToISO(
  dateString: string | null | undefined,
): string | null {
  if (!dateString) return null;
  const trimmed = dateString.trim();
  const ru = trimmed.match(DDMMYYYY_RE);
  if (ru) return `${ru[3]}-${ru[2]}-${ru[1]}`;
  const iso = trimmed.match(ISO_DATE_RE);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

/** Значение input[type=date] (YYYY-MM-DD) → ДД.ММ.ГГГГ */
export function dateInputValueToDDMMYYYY(value: string): string | null {
  return formatDateToDDMMYYYY(value);
}

/** ДД.ММ.ГГГГ или ISO → value для input[type=date] */
export function toDateInputValue(dateString: string | null | undefined): string {
  return parseDDMMYYYYToISO(dateString) ?? "";
}

/** ДД.ММ.ГГГГ → ДД.ММ (для оси X графика) */
export function formatDateToDDMM(dateString: string): string {
  const full = formatDateToDDMMYYYY(dateString);
  if (!full) return dateString;
  const parts = full.split(".");
  if (parts.length >= 2) return `${parts[0]}.${parts[1]}`;
  return full;
}

/** Проверка формата ДД.ММ.ГГГГ */
export function isValidDDMMYYYY(dateString: string): boolean {
  if (!DDMMYYYY_RE.test(dateString.trim())) return false;
  const iso = parseDDMMYYYYToISO(dateString);
  if (!iso) return false;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}
