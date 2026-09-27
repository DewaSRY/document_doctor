import {
  Globe,
  Languages,
  LayoutGrid,
  LayoutTemplate,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";
import { SECTION_IDS, tList, type LandingT } from "./types";

const ICONS: Record<string, LucideIcon> = {
  allInOne: LayoutGrid,
  noInstall: Globe,
  control: UserCheck,
  layout: LayoutTemplate,
  languages: Languages,
  privacy: ShieldCheck,
};

type Feature = { icon: string; title: string; body: string };

export function FeaturesSection({ t }: { t: LandingT }) {
  const items = tList<Feature>(t, "features.items");

  return (
    <section
      id={SECTION_IDS.features}
      aria-labelledby="features-title"
      className="mt-16 scroll-mt-20 border-y bg-card"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
      <SectionHeading
        id="features-title"
        eyebrow={t("features.eyebrow")}
        title={t("features.title")}
        description={t("features.description")}
      />

      <ul className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutGrid;
          return (
            <li
              key={item.title}
              className="flex gap-4"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      </div>
    </section>
  );
}
