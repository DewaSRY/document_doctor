import {
  ImageConverter,
  SINGLE_IMAGE_CONVERSIONS,
  TOOL_HREFS,
} from "@/feature/tools";
import { getTranslation } from "@/i18n/server";
import { isAppLocale, defaultLocale } from "@/i18n/settings";
import { Link } from "@/i18n/navigation";
import { ToolPage, toolMetadata } from "../_tools/tool-page";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/convert-image">) {
  const { locale } = await params;
  return toolMetadata(locale, "image-converter");
}

export default async function ConvertImagePage({
  params,
}: PageProps<"/[locale]/convert-image">) {
  const { locale } = await params;
  const { t } = await getTranslation(
    isAppLocale(locale) ? locale : defaultLocale,
    "tools",
  );

  return (
    <ToolPage locale={locale} tool="image-converter">
      <ImageConverter />
      <nav
        aria-label={t("imageConverter.quickLinksLabel")}
        className="mt-10 flex flex-col gap-3"
      >
        <p className="text-sm font-medium">
          {t("imageConverter.quickLinksLabel")}
        </p>
        <div className="flex flex-wrap gap-2">
          {SINGLE_IMAGE_CONVERSIONS.map((conversion) => (
            <Link
              key={conversion.id}
              href={TOOL_HREFS[conversion.id]}
              className="rounded-lg border bg-card px-3 py-1.5 text-sm hover:border-brand/40"
            >
              {t(`singleImageConversion.${conversion.id}.title`)}
            </Link>
          ))}
        </div>
      </nav>
    </ToolPage>
  );
}
