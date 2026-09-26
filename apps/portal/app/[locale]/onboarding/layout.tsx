import { notFound } from "next/navigation";
import { isAppLocale } from "@/i18n/settings";
import { OnboardingHeader } from "@/components/onboarding/onboarding-header";
import { OnboardingToastViewport } from "@/components/onboarding/onboarding-toast-viewport";

export default async function OnboardingLayout({
  children,
  params,
}: LayoutProps<"/[locale]/onboarding">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background">
      <OnboardingHeader />
      <main className="flex flex-1 flex-col px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </main>
      <OnboardingToastViewport />
    </div>
  );
}
