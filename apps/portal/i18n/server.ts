import "server-only";
import { createInstance } from "i18next";
import { initReactI18next } from "react-i18next/initReactI18next";
import {
  getI18nOptions,
  namespaces,
  type AppLocale,
  type AppNamespace,
} from "./settings";

async function loadMessages(locale: AppLocale) {
  const entries = await Promise.all(
    namespaces.map(async (ns) => {
      const mod = await import(`../messages/${locale}/${ns}.json`);
      return [ns, mod.default] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function getMessages(locale: AppLocale) {
  return loadMessages(locale);
}

export async function getTranslation(
  locale: AppLocale,
  ns: AppNamespace = "common",
) {
  const instance = createInstance();
  const resources = await loadMessages(locale);

  await instance.use(initReactI18next).init({
    ...getI18nOptions(locale, namespaces),
    resources: { [locale]: resources },
  });

  return {
    t: instance.getFixedT(locale, ns),
    i18n: instance,
  };
}
