// TODO: finishes this patter

export type ParamsSearchParams = Record<string, string | string[] | undefined>;

export function parseIntParam(
  value: string | string[] | undefined,
  defaultValue: number,
): number {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === undefined || raw === "") {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}

export function parseStringParam(value: string | string[] | undefined): string {
  if (value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(",");
  }

  return value;
}

export function parseArrayParam(
  value: string | string[] | undefined,
  defaultValue: string[] = [],
): string[] {
  if (value === undefined) {
    return defaultValue;
  }

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value.split(",").filter(Boolean);
}
