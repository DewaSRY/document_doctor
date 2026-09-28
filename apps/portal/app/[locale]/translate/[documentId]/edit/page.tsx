import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { SegmentEditor, TranslatorHeader } from "@/feature/translator";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/translate/[documentId]/edit">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "translator");

  // A user's own document: never index it.
  return {
    title: t("meta.editTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function EditTranslationPage({
  params,
}: PageProps<"/[locale]/translate/[documentId]/edit">) {
  const { locale, documentId } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <>
      <TranslatorHeader />
      <main id="main" className="flex w-full flex-1 flex-col">
        <SegmentEditor documentId={documentId} />
      </main>
    </>
  );
}
