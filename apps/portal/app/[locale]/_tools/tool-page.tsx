import type { Metadata } from "next";
import type { ReactNode } from "react";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { buildLanguageAlternates, canonicalFor } from "@/lib/seo/metadata";
import { TranslatorHeader } from "@/feature/translator";

/** Metadata of a tool page, from messages/<locale>/tools.json → <tool>.meta. */
export async function toolMetadata(
  locale: string,
  tool: string,
  path: string,
): Promise<Metadata> {
  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "tools");

  return {
    title: t(`${tool}.meta.title`),
    description: t(`${tool}.meta.description`),
    alternates: {
      canonical: canonicalFor(locale, path),
      languages: buildLanguageAlternates(path),
    },
  };
}

export function ToolPage({ children }: { children: ReactNode }) {
  return (
    <>
      <TranslatorHeader />
      <main id="main" className="flex w-full flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-2xl flex-col px-4 py-10 sm:py-14">
          {children}
        </div>
      </main>
    </>
  );
}
