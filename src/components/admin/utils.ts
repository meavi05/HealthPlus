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
