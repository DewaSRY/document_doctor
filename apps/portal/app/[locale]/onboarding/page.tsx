import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PlusCircle,
  ArrowLeftRight,
  Wallet,
  Table2,
  ArrowRight,
} from "lucide-react";
import { isAppLocale } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { canonicalFor, buildLanguageAlternates } from "@/lib/seo/metadata";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/onboarding">): Promise<Metadata> {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    return {};
  }

  const { t } = await getTranslation(locale, "onboarding");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: {
      canonical: canonicalFor(locale, "/onboarding"),
      languages: buildLanguageAlternates("/onboarding"),
    },
  };
}

export default async function OnboardingStartPage({
  params,
}: PageProps<"/[locale]/onboarding">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const { t } = await getTranslation(locale, "onboarding");

  const steps = [
    {
      icon: PlusCircle,
      title: t("start.step1Title"),
      description: t("start.step1Description"),
    },
    {
      icon: Wallet,
      title: t("start.step2Title"),
      description: t("start.step2Description"),
    },
    {
      icon: ArrowLeftRight,
      title: t("start.step3Title"),
      description: t("start.step3Description"),
    },
    {
      icon: Table2,
      title: t("start.step4Title"),
      description: t("start.step4Description"),
    },
  ];

  return (
    <div className="space-y-10 pb-6 pt-10 text-center">
      <div className="space-y-4">
        <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10">
          {t("badge")}
        </span>
        <h1 className="mx-auto  text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          {t("start.title")}
        </h1>
        <p className="mx-auto  text-muted-foreground text-balance">
          {t("start.description")}
        </p>
        <Button
          size="lg"
          className="h-12 gap-2 px-8 text-base"
          nativeButton={false}
          render={<Link href="/onboarding/create-account" />}
        >
          {t("start.cta")}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>

      <div className="grid gap-4 text-left sm:grid-cols-2 py-4">
        {steps.map((step, index) => (
          <Card key={step.title}>
            <CardContent className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xs bg-primary/10 text-sm font-semibold text-primary">
                {index + 1}
              </span>
              <div>
                <p className="flex items-center gap-1.5 font-medium">
                  <step.icon
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                  {step.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
