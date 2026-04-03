export function formatCurrency(value?: number) {
  if (value == null || Number.isNaN(value)) return '-';
  return `₹${value.toFixed(2)}`;
}

export function toPercent(value?: number) {
  if (value == null || Number.isNaN(value)) return '-';
  return `${value.toFixed(2)}%`;
}

export function formatDate(value?: string) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function parsePackSize(pack?: string) {
  const value = String(pack || '').trim().toUpperCase();
  if (!value) return 1;
  const numbers = (value.match(/\d+/g) || []).map((token) => Number(token)).filter((num) => Number.isFinite(num) && num > 0);
  if (numbers.length === 0) return 1;
  if (value.includes('X')) {
    return Math.max(1, numbers[numbers.length - 1]);
  }
  return Math.max(1, numbers[0]);
}

export function formatPackSplitStock(stock?: number, pack?: string) {
  const safeStock = Math.max(0, Number(stock || 0));
  const packSize = parsePackSize(pack);
  if (packSize <= 1) return `${safeStock}:0 strips`;
  const fullStrips = Math.floor(safeStock / packSize);
  const looseUnits = safeStock % packSize;
  return `${fullStrips}:${looseUnits} strips`;
}
