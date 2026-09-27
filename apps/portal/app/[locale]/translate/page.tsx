import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { buildLanguageAlternates, canonicalFor } from "@/lib/seo/metadata";
import { TranslateWizard, TranslatorHeader } from "@/feature/translator";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/translate">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "translator");

  return {
    title: t("meta.title"),
    description: t("meta.description"),
    alternates: {
      canonical: canonicalFor(locale, "/translate"),
      languages: buildLanguageAlternates("/translate"),
    },
  };
}

export default async function TranslatePage({
  params,
}: PageProps<"/[locale]/translate">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <>
      <TranslatorHeader />
      <main id="main" className="flex w-full flex-1 flex-col">
        <TranslateWizard />
      </main>
    </>
  );
}
