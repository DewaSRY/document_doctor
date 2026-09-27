import {
  MousePointerClick,
  PencilLine,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { tList, type LandingT } from "./types";

const ICONS: Record<string, LucideIcon> = {
  simple: MousePointerClick,
  fast: Zap,
  editable: PencilLine,
  privacy: ShieldCheck,
};

type Principle = { icon: string; title: string; body: string };

export function PrinciplesStrip({ t }: { t: LandingT }) {
  const items = tList<Principle>(t, "principles.items");

  return (
    <section aria-label={t("principles.label")} className="border-y bg-muted/30">
      <ul className="mx-auto grid w-full max-w-6xl grid-cols-1 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? MousePointerClick;
          return (
            <li
              key={item.title}
              className="flex gap-3 border-border py-6 sm:px-4 sm:py-8 max-sm:not-last:border-b sm:odd:border-r lg:border-r lg:last:border-r-0"
            >
              <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
              <div>
                <h3 className="text-sm font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
