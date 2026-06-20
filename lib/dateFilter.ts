export function matchesDateFilter(timestamp: number, from: string, to: string): boolean {
  if (!from && !to) return true;
  const date = new Date(timestamp);
  if (from) {
    const [y, m, d] = from.split('-').map(Number);
    if (date < new Date(y, m - 1, d, 0, 0, 0, 0)) return false;
  }
  if (to) {
    const [y, m, d] = to.split('-').map(Number);
    if (date > new Date(y, m - 1, d, 23, 59, 59, 999)) return false;
  }
  return true;
}

export function isDateFilterActive(from: string, to: string): boolean {
  return !!(from || to);
}
