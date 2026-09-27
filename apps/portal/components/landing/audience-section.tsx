import {
  Briefcase,
  Building2,
  Code2,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";
import { tList, type LandingT } from "./types";

const ICONS: Record<string, LucideIcon> = {
  office: Briefcase,
  developers: Code2,
  students: GraduationCap,
  business: Building2,
};

type Audience = { icon: string; title: string; body: string; needs: string[] };

export function AudienceSection({ t }: { t: LandingT }) {
  const items = tList<Audience>(t, "audience.items");

  return (
    <section
      aria-labelledby="audience-title"
      className="border-y bg-muted/30"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading
          id="audience-title"
          eyebrow={t("audience.eyebrow")}
          title={t("audience.title")}
        />
        <ul className="mt-14 grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = ICONS[item.icon] ?? Briefcase;
            return (
              <li
                key={item.title}
                className="flex gap-4 rounded-xl border bg-card p-6"
              >
                <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
                <div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                  <ul
                    aria-label={t("audience.needsLabel")}
                    className="mt-3 flex flex-wrap gap-1.5"
                  >
                    {item.needs.map((need) => (
                      <li
                        key={need}
                        className="rounded-full border bg-background px-2.5 py-0.5 text-xs text-muted-foreground"
                      >
                        {need}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
