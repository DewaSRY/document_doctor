import { defaultLocale, isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { renderOgImage } from "@/lib/seo/og-image";
import type { ToolId } from "@/lib/seo/routes";
import { toolCards } from "./tool-page";

/** Social preview of a tool page: its title, the tool name, and its formats. */
export async function toolOgImage(rawLocale: string, tool: ToolId) {
  const locale = isAppLocale(rawLocale) ? rawLocale : defaultLocale;
  const { t } = await getTranslation(locale, "seo");
  const { t: tLanding } = await getTranslation(locale, "landing");
  const card = toolCards(tLanding).get(tool);

  return renderOgImage({
    title: t(`tools.${tool}.meta.title`),
    accent: card?.name,
    chips: card ? [...card.formats, card.limit] : [],
  });
}
