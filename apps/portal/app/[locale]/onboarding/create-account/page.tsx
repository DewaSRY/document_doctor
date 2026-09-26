import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { CreateAccountFlow } from "@/components/onboarding/create-account-flow";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding/create-account">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "onboarding");

  return {
    title: t("createAccount.title"),
    description: t("createAccount.description"),
    alternates: {
      canonical: canonicalFor(locale, "/onboarding/create-account"),
      languages: buildLanguageAlternates("/onboarding/create-account"),
    },
  };
}

export default async function OnboardingCreateAccountPage({
  params,
}: PageProps<"/[locale]/onboarding/create-account">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const { t } = await getTranslation(locale, "onboarding");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">{t("createAccount.eyebrow")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {t("createAccount.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("createAccount.description")}
        </p>
      </div>

      <CreateAccountFlow />
    </div>
  );
}
