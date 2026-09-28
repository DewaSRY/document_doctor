import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isAppLocale, type AppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, pageMetadata } from "@/lib/seo/metadata";
import { TOOL_CATEGORIES, toolPath, type ToolId } from "@/lib/seo/routes";
import {
  breadcrumbNode,
  faqNode,
  graph,
  ORGANIZATION_ID,
  siteNodes,
  WEBSITE_ID,
} from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/json-ld";
import { LandingNav } from "@/components/landing/landing-nav";
import { LandingFooter } from "@/components/landing/landing-footer";
import { tList } from "@/components/landing/types";
import type { ToolGroup } from "@/components/landing/tools-section";
import { cn } from "@/lib/utils";
import { ToolBreadcrumb } from "./tool-breadcrumb";
import { ToolDetails, type FaqItem } from "./tool-details";

/** Metadata of a tool page, from messages/<locale>/seo.json → tools.<tool>.meta. */
export async function toolMetadata(
  locale: string,
  tool: ToolId,
): Promise<Metadata> {
  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "seo");

  return pageMetadata({
    locale,
    path: toolPath(tool),
    title: t(`tools.${tool}.meta.title`),
    description: t(`tools.${tool}.meta.description`),
  });
}

/** Tool names and card copy, from the landing page's tool grid. */
export function toolCards(t: Awaited<ReturnType<typeof getTranslation>>["t"]) {
  return new Map(
    tList<ToolGroup>(t, "tools.groups").flatMap((group) =>
      group.items.map((item) => [item.icon, item] as const),
    ),
  );
}

/** A public tool page: site header, breadcrumb, the interactive tool, then
 *  server-rendered details (benefits, limits, steps, FAQ, related tools). */
export async function ToolPage({
  locale: rawLocale,
  tool,
  contained = true,
  children,
}: {
  locale: string;
  tool: ToolId;
  /** False when the tool lays out its own centered column. */
  contained?: boolean;
  children: ReactNode;
}) {
  if (!isAppLocale(rawLocale)) {
    notFound();
  }
  const locale: AppLocale = rawLocale;

  const { t } = await getTranslation(locale, "seo");
  const { t: tLanding } = await getTranslation(locale, "landing");
  const { t: tCommon } = await getTranslation(locale, "common");

  const cards = toolCards(tLanding);
  const name = cards.get(tool)?.name ?? t(`tools.${tool}.meta.title`);
  const url = canonicalFor(locale, toolPath(tool));
  const faqs = tList<FaqItem>(t, `tools.${tool}.faq`);
  const benefits = tList<{ title: string }>(t, `tools.${tool}.benefits`);

  const jsonLd = graph([
    ...siteNodes(locale),
    {
      "@type": "WebApplication",
      "@id": `${url}#app`,
      name,
      url,
      description: t(`tools.${tool}.meta.description`),
      applicationCategory: TOOL_CATEGORIES[tool],
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser with JavaScript",
      inLanguage: locale,
      featureList: benefits.map((benefit) => benefit.title),
      isPartOf: { "@id": WEBSITE_ID },
      publisher: { "@id": ORGANIZATION_ID },
    },
    breadcrumbNode([
      { name: t("breadcrumb.home"), url: canonicalFor(locale, "") },
      { name, url },
    ]),
    faqNode(locale, faqs),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingNav />
      <main id="main" className="flex w-full flex-1 flex-col">
        <div className="mx-auto w-full max-w-2xl px-4 pt-6">
          <ToolBreadcrumb
            label={t("breadcrumb.label")}
            home={t("breadcrumb.home")}
            current={name}
          />
        </div>
        <div
          id="tool"
          className={cn(
            "scroll-mt-20",
            contained &&
              "mx-auto flex w-full max-w-2xl flex-col px-4 pt-6 pb-12 sm:pt-8 sm:pb-16",
          )}
        >
          {children}
        </div>
        <ToolDetails t={t} tool={tool} cards={cards} faqs={faqs} />
      </main>
      <LandingFooter t={tLanding} appName={tCommon("appName")} />
    </>
  );
}
