import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { notFound } from "next/navigation";
import { locales, isAppLocale } from "@/i18n/settings";
import { getMessages } from "@/i18n/server";
import { TranslationsProvider } from "@/components/translations-provider";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { InlineScript } from "@/components/inline-script";
import { TopProgressBar } from "@/components/common/top-progress-bar";
import { NavigationGuardProvider } from "@/components/common/navigation-guard/provider";
import { TimezoneSync } from "@/lib/timezone-sync";
import { SITE_URL } from "@/lib/seo/metadata";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "../globals.css";

const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("theme")||"light";var d=t==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var e=document.documentElement;if(d==="dark"){e.classList.add("dark")}else{e.classList.remove("dark")}e.style.colorScheme=d}catch(e){}})()`;

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
  title: {
    default: "Simple Bank",
    template: "%s | Simple Bank",
  },
  description:
    "Ledger-based core banking demo — accounts, deposits, and transfers.",
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
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col">
        <NuqsAdapter>
          <ThemeProvider>
            <TranslationsProvider locale={locale} messages={messages}>
              <QueryProvider>
                <TimezoneSync />
                <TopProgressBar />
                {children}
                <NavigationGuardProvider />
              </QueryProvider>
            </TranslationsProvider>
          </ThemeProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
