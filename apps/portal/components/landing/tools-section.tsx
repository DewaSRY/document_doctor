import { ToolGrid } from "./tool-grid";
import { SECTION_IDS, tList, type LandingT } from "./types";

export type Tool = {
  icon: string;
  name: string;
  description: string;
  formats: string[];
  /** What the tool hands back, shown as `formats → output` on its card. */
  output: string;
  limit: string;
};

export type ToolGroup = {
  id: string;
  title: string;
  description: string;
  items: Tool[];
};

/** The whole toolkit: category pills over one grid of tool cards. Sits
 *  right under the hero, so its heading is for screen readers only — it
 *  keeps the h1 → h2 → h3 outline intact for the tool cards. */
export function ToolsSection({ t }: { t: LandingT }) {
  return (
    <section
      id={SECTION_IDS.tools}
      aria-labelledby="tools-title"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 pt-8 pb-4 sm:px-6"
    >
      <h2 id="tools-title" className="sr-only">
        {t("nav.links.tools")}
      </h2>
      <ToolGrid
        groups={tList<ToolGroup>(t, "tools.groups")}
        labels={{
          all: t("tools.all"),
          filters: t("tools.filtersLabel"),
          formats: t("tools.formatsLabel"),
          output: t("tools.outputLabel"),
          ai: t("tools.aiBadge"),
        }}
      />
    </section>
  );
}
