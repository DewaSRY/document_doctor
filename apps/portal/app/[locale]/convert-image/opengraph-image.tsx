import { locales } from "@/i18n/settings";
import { toolOgImage } from "../_tools/tool-og-image";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const alt = "Document Doctor — Convert Images Online";

export default async function Image({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return toolOgImage(locale, "image-converter");
}
