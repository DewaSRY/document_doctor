/**
 * The API sends UTC ISO-8601 timestamps (`...Z`). They are shown in the
 * viewer's zone; the default is `Asia/Jakarta` (ADR-003 §3.3).
 */
export const DEFAULT_TIME_ZONE = "Asia/Jakarta";

const INTL_LOCALE: Record<string, string> = { id: "id-ID", en: "en-GB" };

export function intlLocale(locale: string): string {
  return INTL_LOCALE[locale] ?? locale;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export interface DateFormatOptions {
  locale?: string;
  timeZone?: string;
}

/** `28 Okt 2026` */
export function formatDate(
  value: string | Date | null | undefined,
  { locale = "id", timeZone = DEFAULT_TIME_ZONE }: DateFormatOptions = {},
): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  }).format(date);
}

/** `28 Okt 2026, 10.15 WIB` */
export function formatDateTime(
  value: string | Date | null | undefined,
  { locale = "id", timeZone = DEFAULT_TIME_ZONE }: DateFormatOptions = {},
): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(date);
}

/** `10.42` — used for "Saved 10:42". */
export function formatTime(
  value: string | Date | null | undefined,
  { locale = "id", timeZone }: DateFormatOptions = {},
): string {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}

/** The browser's zone, or the default on the server / when unknown. */
export function browserTimeZone(): string {
  if (typeof window === "undefined") return DEFAULT_TIME_ZONE;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIME_ZONE;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** `YYYY-MM-DD` in the given zone — for `<input type="date">` and API `from`/`to`. */
export function toIsoDate(value: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(value);
  return parts;
}
