"use client";

import { useEffect, useState } from "react";
import { createInstance, type Resource } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { getI18nOptions, namespaces, type AppLocale } from "@/i18n/settings";

interface TranslationsProviderProps {
  children: React.ReactNode;
  locale: AppLocale;
  messages: Record<string, unknown>;
}

function createI18nInstance(locale: AppLocale, messages: Record<string, unknown>) {
  const instance = createInstance();
  instance.use(initReactI18next).init({
    ...getI18nOptions(locale, namespaces),
    resources: { [locale]: messages } as Resource,
  });
  return instance;
}

export function TranslationsProvider({
  children,
  locale,
  messages,
}: TranslationsProviderProps) {
  const [i18n] = useState(() => createI18nInstance(locale, messages));

  useEffect(() => {
    for (const ns of namespaces) {
      if (!i18n.hasResourceBundle(locale, ns)) {
        i18n.addResourceBundle(locale, ns, messages[ns]);
      }
    }
    if (i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [i18n, locale, messages]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
