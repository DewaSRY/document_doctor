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
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28"
    >
      <SectionHeading
        id="features-title"
        eyebrow={t("features.eyebrow")}
        title={t("features.title")}
        description={t("features.description")}
      />

      <ul className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? LayoutGrid;
          return (
            <li
              key={item.title}
              className="group rounded-xl border bg-card p-6 transition duration-200 hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md motion-reduce:hover:translate-y-0"
            >
              <span className="grid size-10 place-items-center rounded-lg bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-primary-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
