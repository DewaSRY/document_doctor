import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { CompletionSummary } from "@/components/onboarding/completion-summary";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding/complete">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "onboarding");

  return {
    title: t("complete.title"),
    description: t("complete.description"),
    alternates: {
      canonical: canonicalFor(locale, "/onboarding/complete"),
      languages: buildLanguageAlternates("/onboarding/complete"),
    },
  };
}

export default async function OnboardingCompletePage({
  params,
}: PageProps<"/[locale]/onboarding/complete">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return <CompletionSummary />;
}
