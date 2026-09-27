import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAppLocale, locales, type AppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import {
  SITE_NAME,
  SITE_URL,
  canonicalFor,
  buildLanguageAlternates,
} from "@/lib/seo/metadata";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import {
  ToolsSection,
  type ToolGroup,
} from "@/components/landing/tools-section";
import { UseCasesSection } from "@/components/landing/use-cases-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { ReviewEditSection } from "@/components/landing/review-edit-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { FaqSection, type FaqItem } from "@/components/landing/faq-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { tList } from "@/components/landing/types";

const OG_LOCALES: Record<AppLocale, string> = { en: "en_US", id: "id_ID" };

export async function generateMetadata({
  params,
}: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "landing");
  const title = t("meta.title");
  const description = t("meta.description");

  // Images come from the sibling opengraph-image.tsx file convention.
  return {
    title: { absolute: title },
    description,
    keywords: tList<string>(t, "meta.keywords"),
    alternates: {
      canonical: canonicalFor(locale, ""),
      languages: buildLanguageAlternates(""),
    },
    openGraph: {
      title,
      description,
      type: "website",
      siteName: SITE_NAME,
      url: canonicalFor(locale, ""),
      locale: OG_LOCALES[locale],
      alternateLocale: locales
        .filter((l) => l !== locale)
        .map((l) => OG_LOCALES[l]),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: { index: true, follow: true },
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/icons/android-chrome-512x512.png`,
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        url: pageUrl,
        inLanguage: locale,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "WebApplication",
        name: SITE_NAME,
        url: pageUrl,
        description: t("meta.description"),
        applicationCategory: "ProductivityApplication",
        operatingSystem: "Web",
        inLanguage: locale,
        featureList: tools.map((tool) => tool.name),
        availableLanguage: languages.map((l) => l.name),
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "FAQPage",
        inLanguage: locale,
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-4 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("nav.skipToContent")}
      </a>
      <LandingNav />
      <main id="main" className="flex w-full flex-1 flex-col">
        <div className="relative isolate">
          {/* Faint grid + a soft red wash at the top — texture, not decoration. */}
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] bg-size-[48px_48px] opacity-60"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 -top-40 -z-10 mx-auto h-96 max-w-3xl rounded-full bg-brand/15 blur-3xl"
          />
          <HeroSection t={t} />
          <ToolsSection t={t} />
        </div>

        <UseCasesSection t={t} />
        <HowItWorksSection t={t} />
        <ReviewEditSection t={t} />
        <FeaturesSection t={t} />
        <FaqSection t={t} />
        <FinalCtaSection t={t} />
      </main>
      <LandingFooter t={t} appName={tCommon("appName")} />
    </>
  );
}
