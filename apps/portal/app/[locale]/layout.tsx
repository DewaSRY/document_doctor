import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { locales, isAppLocale } from "@/i18n/settings";
import { getMessages, getTranslation } from "@/i18n/server";
import { TranslationsProvider } from "@/components/translations-provider";
import { QueryProvider } from "@/providers/query-provider";
import { LeaveGuardProvider } from "@/components/leave-guard";
import { TimezoneSync } from "@/lib/timezone-sync";
import { SITE_NAME, SITE_URL } from "@/lib/seo/metadata";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Search Console / Bing Webmaster Tools ownership tokens, only when configured.
const GOOGLE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const BING_VERIFICATION = process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION;

/** Defaults; indexable pages set their own via buildPageMetadata(). */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Simple AI-powered tools for working with documents and digital files.",
  openGraph: { type: "website", siteName: SITE_NAME },
  twitter: { card: "summary_large_image" },
  verification: {
    google: GOOGLE_VERIFICATION || undefined,
    other: BING_VERIFICATION ? { "msvalidate.01": BING_VERIFICATION } : undefined,
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!isAppLocale(locale)) {
    notFound();
  }

  const messages = await getMessages(locale);
  const { t } = await getTranslation(locale, "common");

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-background px-4 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skipToContent")}
        </a>
        <NuqsAdapter>
          <TranslationsProvider locale={locale} messages={messages}>
            <QueryProvider>
              <LeaveGuardProvider>
                <TimezoneSync />
                {children}
              </LeaveGuardProvider>
            </QueryProvider>
          </TranslationsProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
