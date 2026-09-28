import { isAppLocale, defaultLocale, locales } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { SITE_NAME } from "@/lib/seo/metadata";
import { renderOgImage } from "@/lib/seo/og-image";
import { tList } from "@/components/landing/types";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// One image per locale, rendered at build time.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export const alt = `${SITE_NAME} — simple AI tools for documents`;

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale = isAppLocale(raw) ? raw : defaultLocale;
  const { t } = await getTranslation(locale, "landing");

  return renderOgImage({
    title: t("hero.title"),
    accent: t("hero.titleAccent"),
    chips: tList<string>(t, "hero.trust"),
  });
}
