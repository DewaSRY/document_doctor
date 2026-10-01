import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { SITE_NAME, canonicalFor, buildPageMetadata } from "@/lib/seo/metadata";
import { TOOL_IDS } from "@/lib/seo/routes";
import { faqNode, graph, ORGANIZATION_ID, siteNodes } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/json-ld";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import {
  ToolsSection,
  type ToolGroup,
} from "@/components/landing/tools-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { ReviewEditSection } from "@/components/landing/review-edit-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FaqSection, type FaqItem } from "@/components/landing/faq-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { tList } from "@/components/landing/types";
import { TOOL_HREFS } from "@/feature/tools/constants";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "landing");

  // Images come from the sibling opengraph-image.tsx file convention.
  return {
    ...buildPageMetadata({
      locale,
      path: "",
      title: t("meta.title"),
      description: t("meta.description"),
      absoluteTitle: true,
    }),
    keywords: tList<string>(t, "meta.keywords"),
  };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const { t } = await getTranslation(locale, "landing");
  const { t: tCommon } = await getTranslation(locale, "common");
  const pageUrl = canonicalFor(locale, "");
  const faqs = tList<FaqItem>(t, "faq.items");
  const languages = tList<{ name: string }>(t, "languages.items");
  const tools = tList<ToolGroup>(t, "tools.groups").flatMap((g) => g.items);

  const jsonLd = graph([
    ...siteNodes(locale),
    {
      "@type": "WebApplication",
      "@id": `${pageUrl}#app`,
      name: SITE_NAME,
      url: pageUrl,
      description: t("meta.description"),
      applicationCategory: "BusinessApplication",
      operatingSystem: "Any",
      inLanguage: locale,
      featureList: tools.map((tool) => tool.name),
      availableLanguage: languages.map((l) => l.name),
      publisher: { "@id": ORGANIZATION_ID },
    },
    {
      // The toolkit, each entry pointing at the tool's own page.
      "@type": "ItemList",
      itemListElement: TOOL_IDS.map((id, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: tools.find((tool) => tool.icon === id)?.name ?? id,
        url: canonicalFor(locale, TOOL_HREFS[id]),
      })),
    },
    faqNode(locale, faqs),
  ]);

  return (
    <>
      <JsonLd data={jsonLd} />
      <LandingNav />
      {/* Flat light-gray canvas so the white tool cards carry the page. */}
      <main id="main" className="flex w-full flex-1 flex-col bg-muted">
        <HeroSection t={t} />
        <ToolsSection t={t} />
        <HowItWorksSection t={t} />
        <ReviewEditSection t={t} />
        <UseCasesSection t={t} />
        <FeaturesSection t={t} />
        <FaqSection t={t} />
        <FinalCtaSection t={t} />
      </main>
      <LandingFooter t={t} appName={tCommon("appName")} />
    </>
  );
}
