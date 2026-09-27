import { BrandLogo } from "@/components/brand-logo";
import { Link } from "@/i18n/navigation";
import { TOOL_HREFS } from "@/feature/tools/constants";
import type { ToolGroup } from "./tools-section";
import { SECTION_IDS, START_HREF, tList, type LandingT } from "./types";

export function LandingFooter({
  t,
  appName,
}: {
  t: LandingT;
  appName: string;
}) {
  const links = [
    { href: `#${SECTION_IDS.tools}`, label: t("nav.links.tools") },
    { href: `#${SECTION_IDS.useCases}`, label: t("nav.links.useCases") },
    { href: `#${SECTION_IDS.howItWorks}`, label: t("nav.links.howItWorks") },
    { href: `#${SECTION_IDS.features}`, label: t("nav.links.features") },
    { href: `#${SECTION_IDS.faq}`, label: t("nav.links.faq") },
  ];
  const tools = tList<ToolGroup>(t, "tools.groups").flatMap((g) => g.items);

  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:flex-row sm:justify-between sm:px-6">
        <div className="max-w-xs">
          <BrandLogo name={appName} />
          <p className="mt-3 text-sm text-muted-foreground">
            {t("footer.tagline")}
          </p>
        </div>
        <div className="flex gap-16">
          <nav aria-labelledby="footer-tools">
            <p id="footer-tools" className="text-sm font-semibold">
              {t("footer.tools")}
            </p>
            <ul className="mt-3 flex flex-col gap-2">
              {tools.map((tool) => (
                <li key={tool.icon}>
                  <Link
                    href={TOOL_HREFS[tool.icon] ?? START_HREF}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
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
      </div>
      <div className="border-t">
        <p className="mx-auto w-full max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} {appName}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
