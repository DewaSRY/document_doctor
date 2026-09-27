export const locales = ["id", "en"] as const;
export const defaultLocale: AppLocale = "id";

export type AppLocale = (typeof locales)[number];

export function isAppLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}

/** Namespaces sent to the browser with every page. */
export const namespaces = [
  "common",
  "auth",
  "landing",
  "translator",
  "editor",
  "tools",
] as const;

/** Namespaces only Server Components read (page copy, metadata), so they
 *  stay out of the client payload. */
export const serverNamespaces = ["seo"] as const;

export type AppNamespace =
  | (typeof namespaces)[number]
  | (typeof serverNamespaces)[number];
export const defaultNamespace: AppNamespace = "common";

export function getI18nOptions(
  locale: AppLocale = defaultLocale,
  ns: AppNamespace | readonly AppNamespace[] = defaultNamespace,
) {
  return {
    supportedLngs: locales,
    fallbackLng: defaultLocale,
    lng: locale,
    fallbackNS: defaultNamespace,
    defaultNS: defaultNamespace,
    ns,
    interpolation: {
      escapeValue: false,
    },
  };
}
