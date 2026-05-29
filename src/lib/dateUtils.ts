export function parseDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    if ('seconds' in value) return new Date(value.seconds * 1000);
    if ('_seconds' in value) return new Date(value._seconds * 1000);
  }
  return null;
}

export function parseDateSafe(value: any): Date {
  return parseDate(value) ?? new Date();
}
