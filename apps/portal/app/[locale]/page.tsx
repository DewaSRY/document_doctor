import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MotionConfig } from "motion/react";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { LandingNav } from "@/components/landing/landing-nav";
import { HeroSection } from "@/components/landing/hero-section";
import { OverviewSection } from "@/components/landing/overview-section";
import { SystemJourneySection } from "@/components/landing/system-journey-section";
import { FrontendEngineeringSection } from "@/components/landing/frontend-engineering-section";
import { BackendEngineeringSection } from "@/components/landing/backend-engineering-section";
import { BankingDomainSection } from "@/components/landing/banking-domain-section";
import { DatabaseArchitectureSection } from "@/components/landing/database-architecture-section";
import { ApiArchitectureSection } from "@/components/landing/api-architecture-section";
import { SecuritySection } from "@/components/landing/security-section";
import { InfrastructureSection } from "@/components/landing/infrastructure-section";
import { EngineeringDecisionsSection } from "@/components/landing/engineering-decisions-section";
import { RequestFlowSection } from "@/components/landing/request-flow-section";
import { CapabilitySummarySection } from "@/components/landing/capability-summary-section";
import { TechStackSection } from "@/components/landing/tech-stack-section";
import { FinalCtaSection } from "@/components/landing/final-cta-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { AUTHOR } from "@/components/landing/author";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";

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

  return {
    title: { absolute: title },
    description,
    authors: [{ name: AUTHOR.name, url: AUTHOR.githubUrl }],
    creator: AUTHOR.name,
    alternates: {
      canonical: canonicalFor(locale, ""),
      languages: buildLanguageAlternates(""),
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalFor(locale, ""),
      locale,
      images: [
        {
          url: "/icons/android-chrome-512x512.png",
          width: 512,
          height: 512,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/icons/android-chrome-512x512.png"],
    },
  };
}

export default async function Home({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <MotionConfig reducedMotion="user">
      <script
        id="website-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Simple Bank",
            url: canonicalFor(locale, ""),
            author: {
              "@type": "Person",
              name: AUTHOR.name,
              email: AUTHOR.email,
              url: AUTHOR.githubUrl,
              sameAs: [AUTHOR.githubUrl, AUTHOR.linkedinUrl],
            },
          }).replace(/</g, "\\u003c"),
        }}
      />
      <main className="flex min-h-screen w-full flex-col">
        <LandingNav />

        <AuthBackdrop>
          <HeroSection />
        </AuthBackdrop>

        <OverviewSection />
        <SystemJourneySection />
        <FrontendEngineeringSection />
        <BackendEngineeringSection />
        <BankingDomainSection />
        <DatabaseArchitectureSection />
        <ApiArchitectureSection />
        <SecuritySection />
        <InfrastructureSection />
        <EngineeringDecisionsSection />
        <RequestFlowSection />
        <CapabilitySummarySection />
        <TechStackSection />
        <FinalCtaSection />
        <LandingFooter />
      </main>
    </MotionConfig>
  );
}
