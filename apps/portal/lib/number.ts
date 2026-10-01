/**
 * Money is an integer number of rupiah (ADR-003 §3.3). Always formatted with
 * `id-ID` grouping so amounts look the same in both UI languages.
 */
export function formatMoney(
  money: { amount: number; currency?: string } | null | undefined,
  options: { compact?: boolean } = {},
): string {
  if (!money || !Number.isFinite(money.amount)) return "—";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: money.currency || "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    notation: options.compact ? "compact" : "standard",
  }).format(money.amount);
}

export function formatNumber(value: number, locale = "id-ID"): string {
  return new Intl.NumberFormat(locale).format(value);
}

/** Human file size (`1.2 MB`). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
