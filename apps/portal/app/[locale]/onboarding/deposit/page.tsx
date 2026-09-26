import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { DepositFlow } from "@/components/onboarding/deposit-flow";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding/deposit">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "onboarding");

  return {
    title: t("deposit.title"),
    description: t("deposit.description"),
    alternates: {
      canonical: canonicalFor(locale, "/onboarding/deposit"),
      languages: buildLanguageAlternates("/onboarding/deposit"),
    },
  };
}

export default async function OnboardingDepositPage({
  params,
}: PageProps<"/[locale]/onboarding/deposit">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const { t } = await getTranslation(locale, "onboarding");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t("deposit.eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{t("deposit.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("deposit.description")}</p>
      </div>

      <DepositFlow />
    </div>
  );
}
