import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { locales, isAppLocale } from "@/i18n/settings";
import { getMessages } from "@/i18n/server";
import { TranslationsProvider } from "@/components/translations-provider";
import { QueryProvider } from "@/providers/query-provider";
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

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: SITE_NAME,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Simple AI-powered tools for working with documents and digital files.",
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

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <NuqsAdapter>
          <TranslationsProvider locale={locale} messages={messages}>
            <QueryProvider>
              <TimezoneSync />
              {children}
            </QueryProvider>
          </TranslationsProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
