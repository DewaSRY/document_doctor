import { BrandLogo } from "@/components/brand-logo";
import { SECTION_IDS, type LandingT } from "./types";

export function LandingFooter({
  t,
  appName,
}: {
  t: LandingT;
  appName: string;
}) {
  const links = [
    { href: `#${SECTION_IDS.tools}`, label: t("nav.links.tools") },
    { href: `#${SECTION_IDS.howItWorks}`, label: t("nav.links.howItWorks") },
    { href: `#${SECTION_IDS.features}`, label: t("nav.links.features") },
    { href: `#${SECTION_IDS.languages}`, label: t("nav.links.languages") },
    { href: `#${SECTION_IDS.faq}`, label: t("nav.links.faq") },
  ];

  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:flex-row sm:justify-between sm:px-6">
        <div className="max-w-xs">
          <BrandLogo name={appName} />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>
        <nav aria-labelledby="footer-product">
          <p id="footer-product" className="text-sm font-semibold">
            {t("footer.product")}
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {appName}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
