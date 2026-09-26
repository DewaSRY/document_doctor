import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { RegisterFormScreen } from "@/components/auth/register-form-screen";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/register">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "auth");
  return {
    title: t("registerMetaTitle"),
    description: t("registerMetaDescription"),
    alternates: {
      canonical: canonicalFor(locale, "/register"),
      languages: buildLanguageAlternates("/register"),
    },
  };
}

export default async function RegisterPage({
  params,
}: PageProps<"/[locale]/register">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return <RegisterFormScreen />;
}
