import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { defaultLocale, locales } from "@/i18n/settings";
import { getTranslation } from "@/i18n/server";
import { SITE_NAME } from "@/lib/seo/metadata";
import { TOOL_IDS, toolPath } from "@/lib/seo/routes";
import { getPathname } from "@/i18n/redirect";
import { BrandLogo } from "@/components/brand-logo";
import { tList } from "@/components/landing/types";
import type { ToolGroup } from "@/components/landing/tools-section";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

// Next adds <meta name="robots" content="noindex"> to 404 responses itself.
export const metadata: Metadata = {
  title: `404 | ${SITE_NAME}`,
};

/** Unmatched URLs, served with a real 404 status. The locale isn't known
 *  here, so the page offers both languages. */
export default async function GlobalNotFound() {
  const sections = await Promise.all(
    locales.map(async (locale) => {
      const { t } = await getTranslation(locale, "seo");
      const { t: tLanding } = await getTranslation(locale, "landing");
      const names = new Map(
        tList<ToolGroup>(tLanding, "tools.groups").flatMap((group) =>
          group.items.map((item) => [item.icon, item.name] as const),
        ),
      );
      return { locale, t, names };
    }),
  );

  return (
    <html lang={defaultLocale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-muted">
        <header className="border-b bg-card shadow-xs">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6">
            <a href={getPathname({ href: "/", locale: defaultLocale })}>
              <BrandLogo name={SITE_NAME} />
            </a>
          </div>
        </header>
        <main className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-16 sm:px-6 md:grid-cols-2">
          {sections.map(({ locale, t, names }) => (
            <section
              key={locale}
              lang={locale}
              aria-labelledby={`not-found-${locale}`}
              className="rounded-xl bg-card p-6 shadow-xs sm:p-8"
            >
              <p className="text-sm font-semibold tracking-wide text-brand uppercase">
                404
              </p>
              {/* One h1 for the page; the second language is its translation. */}
              {locale === defaultLocale ? (
                <h1 id={`not-found-${locale}`} className="mt-2 text-2xl font-bold tracking-tight">
                  {t("notFound.title")}
                </h1>
              ) : (
                <h2 id={`not-found-${locale}`} className="mt-2 text-2xl font-bold tracking-tight">
                  {t("notFound.title")}
                </h2>
              )}
              <p className="mt-2 text-muted-foreground">{t("notFound.description")}</p>
              <a
                href={getPathname({ href: "/", locale })}
                className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                {t("notFound.home")}
              </a>
              <ul className="mt-6 flex flex-col gap-2 border-t pt-6">
                {TOOL_IDS.map((tool) => (
                  <li key={tool}>
                    <a
                      href={getPathname({ href: toolPath(tool), locale })}
                      className="text-sm font-medium hover:text-brand hover:underline"
                    >
                      {names.get(tool) ?? tool}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      </body>
    </html>
  );
}
