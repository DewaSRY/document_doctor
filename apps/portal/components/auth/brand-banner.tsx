import { Wallet } from "lucide-react";

import { useTranslation } from "react-i18next";
import { GuardedLink } from "../common/navigation-guard/guarded-link";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function BrandBanner() {
  const { t: tCommon } = useTranslation("common");

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <GuardedLink
            href="/"
            aria-label={tCommon("backToHome")}
            className="flex items-center gap-2 transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xs"
          >
            <span className="flex size-8 items-center justify-center rounded-xs bg-primary text-primary-foreground">
              <Wallet className="size-4" aria-hidden />
            </span>
            <span className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight leading-tight">
                {tCommon("appName")}
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                {tCommon("brandTagline", { appName: tCommon("appName") })}
              </span>
            </span>
          </GuardedLink>
        }
      />
      <TooltipContent>{tCommon("backToHomeDescription")}</TooltipContent>
    </Tooltip>
  );
}
