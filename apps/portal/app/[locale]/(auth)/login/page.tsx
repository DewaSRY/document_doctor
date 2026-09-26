import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { LoginFormScreen } from "@/components/auth/login-form-screen";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/login">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "auth");
  return {
    title: t("loginMetaTitle"),
    description: t("loginMetaDescription"),
    alternates: {
      canonical: canonicalFor(locale, "/login"),
      languages: buildLanguageAlternates("/login"),
    },
  };
}

export default async function LoginPage({
  params,
}: PageProps<"/[locale]/login">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return <LoginFormScreen />;
}
