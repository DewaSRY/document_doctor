import { ChevronDown } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { SECTION_IDS, tList, type LandingT } from "./types";

export type FaqItem = { question: string; answer: string };

/** Native <details> keeps every answer in the server-rendered HTML (good for
 *  crawlers and the FAQPage JSON-LD) and is keyboard-accessible for free. */
export function FaqSection({ t }: { t: LandingT }) {
  const items = tList<FaqItem>(t, "faq.items");

  return (
    <section
      id={SECTION_IDS.faq}
      aria-labelledby="faq-title"
      className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28"
    >
      <SectionHeading
        id="faq-title"
        eyebrow={t("faq.eyebrow")}
        title={t("faq.title")}
      />
      <div className="mt-12 divide-y rounded-xl border bg-card">
        {items.map((item, index) => (
          <details key={item.question} className="group" open={index === 0}>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-4 text-left font-medium focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
              <h3 className="text-base">{item.question}</h3>
              <ChevronDown
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 group-open:text-brand"
                aria-hidden
              />
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
