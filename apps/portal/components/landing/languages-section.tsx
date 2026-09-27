import { SectionHeading } from "./section-heading";
import { SECTION_IDS, tList, type LandingT } from "./types";

type Language = { code: string; name: string; native: string };

export function LanguagesSection({ t }: { t: LandingT }) {
  const items = tList<Language>(t, "languages.items");

  return (
    <section
      id={SECTION_IDS.languages}
      aria-labelledby="languages-title"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28"
    >
      <SectionHeading
        id="languages-title"
        eyebrow={t("languages.eyebrow")}
        title={t("languages.title")}
        description={t("languages.description")}
      />

      <ul className="mt-14 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((lang) => (
          <li
            key={lang.code}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-brand/30"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft font-mono text-xs font-semibold text-brand-foreground uppercase">
              {lang.code}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">
                {lang.name}
              </span>
              <span
                lang={lang.code}
                className="block truncate text-sm text-muted-foreground"
              >
                {lang.native}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
