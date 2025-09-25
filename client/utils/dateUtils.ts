// Utility functions for date parsing and formatting

const toISODateLocal = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDateLocalISO = (d: Date): string => toISODateLocal(d);

const parseISOToLocalDate = (s: string): Date | null => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const d = new Date(y, mm - 1, dd);
  return isNaN(d.getTime()) ? null : d;
};

/**
 * Converts Excel/CSV input value to ISO date (YYYY-MM-DD) without timezone shifts
 * Excel stores dates as numbers (days since 1900-01-01)
 */
export const parseExcelDate = (value: any): string => {
  if (!value) return '';

  if (typeof value === 'string' && value.includes('####')) {
    return '';
  }

  // If it's already ISO date
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Try to parse common slash formats like MM/DD/YYYY or DD/MM/YYYY
  if (typeof value === 'string' && value.includes('/')) {
    const parts = value.split('/').map(p => p.trim());
    if (parts.length === 3) {
      let a = parseInt(parts[0], 10);
      let b = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);
      if (String(y).length === 2) y += y >= 70 ? 1900 : 2000; // naive 2-digit year handling
      // Decide which is month/day
      let month: number;
      let day: number;
      if (a > 12 && b <= 12) { // DD/MM/YYYY
        day = a; month = b;
      } else if (b > 12 && a <= 12) { // MM/DD/YYYY
        month = a; day = b;
      } else { // Ambiguous, default to MM/DD/YYYY
        month = a; day = b;
      }
      const d = new Date(y, month - 1, day);
      if (!isNaN(d.getTime())) return toISODateLocal(d);
    }
    // Fallback to Date parser but keep local components
    try {
      const d = new Date(value);
      if (!isNaN(d.getTime())) return toISODateLocal(d);
    } catch {}
  }

  // If it's a number (Excel date format)
  const numValue = typeof value === 'number' ? value : parseFloat(value);
  if (!isNaN(numValue) && numValue > 0) {
    try {
      // Excel epoch 1900-01-01 with leap-year bug compensation (subtract 1 extra day)
      const excelEpoch = new Date(1900, 0, 1);
      const d = new Date(excelEpoch.getTime() + (numValue - 2) * 86400000);
      if (!isNaN(d.getTime())) return toISODateLocal(d);
    } catch {}
  }

  return '';
};

/**
 * Formats date for display without timezone surprises
 */
export const formatDateForDisplay = (dateString: string): string => {
  if (!dateString) return '';

  // Handle ISO dates explicitly in local time
  const localFromISO = parseISOToLocalDate(dateString);
  if (localFromISO) return localFromISO.toLocaleDateString('en-US');

  try {
    const d = new Date(dateString);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('en-US');
  } catch {}

  return dateString;
};

/**
 * Computes expiry date as exactly 1 year after the join date.
 * Returns ISO date (YYYY-MM-DD) or empty string if invalid input.
 */
export const computeExpiryDate = (joinDate: string): string => {
  if (!joinDate) return '';
  const base = parseISOToLocalDate(joinDate) ?? new Date(joinDate);
  if (isNaN(base.getTime())) return '';
  base.setFullYear(base.getFullYear() + 1);
  return toISODateLocal(base);
};

/**
 * Validates if a date string is valid
 */
export const isValidDate = (dateString: string): boolean => {
  if (!dateString) return false;
  const d = parseISOToLocalDate(dateString) ?? new Date(dateString);
  return !isNaN(d.getTime());
};
