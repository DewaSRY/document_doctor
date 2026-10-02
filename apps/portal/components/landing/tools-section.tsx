"use client";

import { ToolGrid } from "./tool-grid";
import { SECTION_IDS } from "./types";
import { useFeatureGroupsQuery } from "@/feature/constant";

export type Tool = {
  icon: string;
  name: string;
  description: string;
  formats: string[];
  /** What the tool hands back, shown as `formats → output` on its card. */
  output: string;
  limit: string;
  isComingSoon?: boolean;
};

export type ToolGroup = {
  id: string;
  title: string;
  description: string;
  items: Tool[];
};

export type ToolsSectionLabels = {
  heading: string;
  all: string;
  filters: string;
  formats: string;
  output: string;
  ai: string;
  comingSoon: string;
};

/** The whole toolkit: category pills over one grid of tool cards. Sits
 *  right under the hero, so its heading is for screen readers only — it
 *  keeps the h1 → h2 → h3 outline intact for the tool cards. */
export function ToolsSection({
  locale,
  labels,
}: {
  locale: string;
  labels: ToolsSectionLabels;
}) {
  const { data: featureGroups } = useFeatureGroupsQuery(locale);
  return (
    <section
      id={SECTION_IDS.tools}
      aria-labelledby="tools-title"
      className="mx-auto w-full max-w-7xl scroll-mt-20 px-4 pt-8 pb-4 sm:px-6"
    >
      <h2 id="tools-title" className="sr-only">
        {labels.heading}
      </h2>
      <ToolGrid
        groups={
          featureGroups?.data.map(({ id, title, description, features }) => ({
            id,
            title,
            description,
            items: features,
          })) ?? []
        }
        labels={{
          all: labels.all,
          filters: labels.filters,
          formats: labels.formats,
          output: labels.output,
          ai: labels.ai,
          comingSoon: labels.comingSoon,
        }}
      />
    </section>
  );
}
