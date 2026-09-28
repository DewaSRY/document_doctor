import { ArrowRight, ArrowUp, Check, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { RELATED_TOOLS, toolPath, type ToolId } from "@/lib/seo/routes";
import { tList, type LandingT } from "@/components/landing/types";
import type { Tool } from "@/components/landing/tools-section";
import {
  FALLBACK_TOOL_COLOR,
  FALLBACK_TOOL_ICON,
  TOOL_COLORS,
  TOOL_ICONS,
} from "@/components/landing/tool-icons";

export type FaqItem = { question: string; answer: string };

type Benefit = { title: string; body: string };
type Spec = { label: string; value: string };
type Step = { title: string; body: string };

const H2_CLASS = "text-2xl font-bold tracking-tight text-balance sm:text-3xl";

/** What the tool does, its limits, how to use it, FAQ and related tools —
 *  rendered on the server so it is in the HTML without JavaScript. */
export function ToolDetails({
  t,
  tool,
  cards,
  faqs,
}: {
  t: LandingT;
  tool: ToolId;
  cards: Map<string, Tool>;
  faqs: FaqItem[];
}) {
  const key = `tools.${tool}`;
  const benefits = tList<Benefit>(t, `${key}.benefits`);
  const specs = tList<Spec>(t, `${key}.specs`);
  const steps = tList<Step>(t, `${key}.steps`);
  const related = RELATED_TOOLS[tool].flatMap((id) => {
    const card = cards.get(id);
    return card ? [{ id, ...card }] : [];
  });

  return (
    <div className="border-t bg-muted">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-16 px-4 py-16 sm:px-6 sm:py-20">
        <section aria-labelledby="benefits-title">
          <h2 id="benefits-title" className={H2_CLASS}>
            {t(`${key}.benefitsTitle`)}
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {benefits.map((benefit) => (
              <li key={benefit.title} className="rounded-xl bg-card p-6 shadow-xs">
                <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-brand">
                  <Check className="size-4" aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold">{benefit.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                  {benefit.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="grid gap-16 lg:grid-cols-2 lg:gap-10">
          <section aria-labelledby="specs-title">
            <h2 id="specs-title" className={H2_CLASS}>
              {t("specsTitle")}
            </h2>
            <dl className="mt-8 divide-y rounded-xl bg-card shadow-xs">
              {specs.map((spec) => (
                <div
                  key={spec.label}
                  className="grid gap-1 px-5 py-4 sm:grid-cols-[10rem_1fr] sm:gap-4"
                >
                  <dt className="text-sm font-medium text-muted-foreground">
                    {spec.label}
                  </dt>
                  <dd className="text-sm font-medium">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="steps-title">
            <h2 id="steps-title" className={H2_CLASS}>
              {t(`${key}.stepsTitle`)}
            </h2>
            <ol className="mt-8 flex flex-col gap-4">
              {steps.map((step, index) => (
                <li key={step.title} className="flex gap-4 rounded-xl bg-card p-5 shadow-xs">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <section aria-labelledby="tool-faq-title" className="mx-auto w-full max-w-3xl">
          <h2 id="tool-faq-title" className={cn(H2_CLASS, "text-center")}>
            {t("faqTitle")}
          </h2>
          {/* Native <details>: answers stay in the HTML and work without JS. */}
          <div className="mt-8 divide-y rounded-xl bg-card shadow-xs">
            {faqs.map((item, index) => (
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

        <section aria-labelledby="related-title">
          <h2 id="related-title" className={H2_CLASS}>
            {t("relatedTitle")}
          </h2>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {related.map((card) => {
              const Icon = TOOL_ICONS[card.id] ?? FALLBACK_TOOL_ICON;
              return (
                <li key={card.id} className="flex">
                  <Link
                    href={toolPath(card.id)}
                    className="group flex w-full flex-col rounded-xl border border-transparent bg-card p-5 shadow-xs transition duration-200 hover:border-border hover:shadow-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    <span
                      className={cn(
                        "grid size-10 place-items-center rounded-lg text-white",
                        TOOL_COLORS[card.id] ?? FALLBACK_TOOL_COLOR,
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <h3 className="mt-4 inline-flex items-center gap-1.5 text-base font-semibold">
                      {card.name}
                      <ArrowRight
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                        aria-hidden
                      />
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-pretty text-muted-foreground">
                      {card.description}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <p className="text-center">
          <a
            href="#tool"
            className="inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-brand hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowUp className="size-4" aria-hidden />
            {t(`${key}.cta`)}
          </a>
        </p>
      </div>
    </div>
  );
}
