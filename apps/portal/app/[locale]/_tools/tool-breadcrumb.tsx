import { ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

/** Visible trail matching the BreadcrumbList JSON-LD: Home › Tool. */
export function ToolBreadcrumb({
  label,
  home,
  current,
}: {
  label: string;
  home: string;
  current: string;
}) {
  return (
    <nav aria-label={label}>
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <li>
          <Link
            href="/"
            className="rounded-sm transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {home}
          </Link>
        </li>
        <li aria-hidden>
          <ChevronRight className="size-3.5" />
        </li>
        <li>
          <span aria-current="page" className="font-medium text-foreground">
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
