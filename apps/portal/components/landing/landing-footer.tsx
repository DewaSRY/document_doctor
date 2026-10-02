"use client";

import { BrandLogo } from "@/components/brand-logo";
import { Link } from "@/i18n/navigation";
import { TOOL_HREFS } from "@/feature/tools/constants";
import type { ToolGroup } from "./tools-section";
import { SECTION_IDS, START_HREF, tList, type LandingT } from "./types";
import { useFeatureGroupsQuery } from "@/feature/constant";
import { getTranslation } from "@/i18n/server";
import { useTranslation } from "react-i18next";

const LINK_CLASS =
  "text-sm text-background/65 transition-colors hover:text-background";

/** Dark footer with one column per tool category, then the home page's
 *  sections. Shared by the home page and every tool page. */
export function LandingFooter({ appName }: { appName: string }) {
  const { t, i18n } = useTranslation("landing");
  const { t: tCommon } = useTranslation("common");

  const { data: featureGroups } = useFeatureGroupsQuery(i18n.language);

  const groups =
    featureGroups?.data.map(({ id, title, description, features }) => ({
      id,
      title,
      description,
      items: features,
    })) ?? [];

  const links = [
    { href: `/#${SECTION_IDS.tools}`, label: t("nav.links.tools") },
    { href: `/#${SECTION_IDS.howItWorks}`, label: t("nav.links.howItWorks") },
    { href: `/#${SECTION_IDS.useCases}`, label: t("nav.links.useCases") },
    { href: `/#${SECTION_IDS.features}`, label: t("nav.links.features") },
    { href: `/#${SECTION_IDS.faq}`, label: t("nav.links.faq") },
  ];

  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
        <div className="max-w-xs">
          <BrandLogo name={appName} />
          <p className="mt-3 text-sm text-background/65">
            {t("footer.tagline")}
          </p>
        </div>

        {groups.map((group) => (
          <nav key={group.id} aria-labelledby={`footer-${group.id}`}>
            <p
              id={`footer-${group.id}`}
              className="text-xs font-semibold tracking-wide uppercase"
            >
              {group.title}
            </p>
            <ul className="mt-4 flex flex-col gap-2.5">
              {group.items.map((tool) => (
                <li key={tool.icon} className="mt-3 text-sm text-background/65">
                  <>
                    {tool.isComingSoon && (
                      <div className="flex gap-0.5 items-center">
                        <span> {tool.name}</span>
                        <span className="p-1 rounded bg-background/10 text-xs">
                          {tCommon("comingSoon")}
                        </span>
                      </div>
                    )}

                    {!tool.isComingSoon && (
                      <Link
                        href={TOOL_HREFS[tool.icon] ?? START_HREF}
                        className={LINK_CLASS}
                      >
                        {tool.name}
                      </Link>
                    )}
                  </>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <nav aria-labelledby="footer-product">
          <p
            id="footer-product"
            className="text-xs font-semibold tracking-wide uppercase"
          >
            {t("footer.product")}
          </p>
          <ul className="mt-4 flex flex-col gap-2.5">
            {links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={LINK_CLASS}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-background/10">
        <p className="mx-auto w-full max-w-7xl px-4 py-6 text-xs text-background/55 sm:px-6">
          © {new Date().getFullYear()} {appName}. {t("footer.rights")}
        </p>
      </div>
    </footer>
  );
}
