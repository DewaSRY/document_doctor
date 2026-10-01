import { useTranslation } from "react-i18next";
import { Gauge } from "lucide-react";

import { Link } from "@/i18n/navigation";

import { RESIZE_PRESETS } from "../constants";

/** Common web resolutions shown after a conversion, so developers know
 *  what to resize the converted image to for typical web use cases. */
export function ResolutionSuggestions({ width, height }: { width?: number; height?: number }) {
  const { t } = useTranslation("tools");
  const oversized = RESIZE_PRESETS.filter(
    (preset) => !width || !height || width > preset.width || height > preset.height,
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-brand" aria-hidden />
        <p className="text-sm font-medium">{t("common.resolutionTips.title")}</p>
      </div>
      <p className="text-sm text-muted-foreground">{t("common.resolutionTips.description")}</p>
      <ul className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
        {RESIZE_PRESETS.map((preset) => (
          <li key={preset.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-1.5">
            <span className="font-medium text-foreground">{t(`resizer.presetNames.${preset.id}`)}</span>
            <span className="tabular-nums">
              {preset.width} × {preset.height}
            </span>
          </li>
        ))}
      </ul>
      {oversized.length > 0 && (
        <Link
          href="/resize-image"
          className="self-start text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          {t("common.resolutionTips.cta")}
        </Link>
      )}
    </section>
  );
}
