import "server-only";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next/initReactI18next";
import {
  getI18nOptions,
  namespaces,
  serverNamespaces,
  type AppLocale,
  type AppNamespace,
} from "./settings";

async function loadMessages(
  locale: AppLocale,
  nsList: readonly AppNamespace[] = namespaces,
) {
  const entries = await Promise.all(
    nsList.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );

  return Object.fromEntries(entries);
}

/** Messages for the client TranslationsProvider (no server-only namespaces). */
export async function getMessages(locale: AppLocale) {
  return loadMessages(locale);
}

export async function getTranslation(
  locale: AppLocale,
  ns: AppNamespace = "common",
) {
  const instance = createInstance();
  const allNamespaces = [...namespaces, ...serverNamespaces];
  const resources = await loadMessages(locale, allNamespaces);

  await instance.use(initReactI18next).init({
    ...getI18nOptions(locale, allNamespaces),
    resources: { [locale]: resources },
  });

  return {
    t: instance.getFixedT(locale, ns),
    i18n: instance,
  };
}
