import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  name: string;
  number: string;
  subtitle?: string;
  selected: boolean;
  onClick: () => void;
}

export function AccountCard({
  name,
  number,
  subtitle,
  selected,
  onClick,
}: Props) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full! items-center justify-between gap-2 rounded-xs border px-3 py-2.5 text-left transition-colors hover:bg-muted/50",
        selected
          ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
          : "border-border",
      )}
    >
      <div className="flex flex-col">
        <h3 className="font-medium">{name}</h3>
        <p className="text-sm text-muted-foreground">
          {number}
          {subtitle ? ` · ${subtitle}` : ""}
        </p>
      </div>
      {selected && (
        <Check className="size-4 shrink-0 text-primary" aria-hidden />
      )}
    </button>
  );
}
