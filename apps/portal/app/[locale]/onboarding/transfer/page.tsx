import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { TransferFlow } from "@/components/onboarding/transfer-flow";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding/transfer">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "onboarding");

  return {
    title: t("transfer.title"),
    description: t("transfer.description"),
    alternates: {
      canonical: canonicalFor(locale, "/onboarding/transfer"),
      languages: buildLanguageAlternates("/onboarding/transfer"),
    },
  };
}

export default async function OnboardingTransferPage({
  params,
}: PageProps<"/[locale]/onboarding/transfer">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const { t } = await getTranslation(locale, "onboarding");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t("transfer.eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("transfer.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("transfer.description")}</p>
      </div>

      <TransferFlow />
    </div>
  );
}
