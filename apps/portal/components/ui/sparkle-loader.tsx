import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/* Concave four-point star. Its 90° symmetry lets the core rotate 0→90deg
   per cycle and loop without a visible jump. */
const SPARKLE_PATH =
  "M12 0C12 6.627 17.373 12 24 12C17.373 12 12 17.373 12 24C12 17.373 6.627 12 0 12C6.627 12 12 6.627 12 0Z";

function Sparkle({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className} style={style}>
      <path d={SPARKLE_PATH} />
    </svg>
  );
}

const sparkleLoaderVariants = cva("relative shrink-0", {
  variants: {
    size: {
      xs: "size-4",
      sm: "size-8",
      md: "size-12",
      lg: "size-20",
      xl: "size-28",
    },
    tone: {
      brand: "[--sparkle-core:var(--brand)] [--sparkle-satellite:var(--brand-300)] [--sparkle-glow:var(--brand-100)]",
      muted:
        "[--sparkle-core:var(--muted-foreground)] [--sparkle-satellite:color-mix(in_oklch,var(--muted-foreground)_55%,transparent)] [--sparkle-glow:var(--muted)]",
      // Inherits text color — use inside buttons or colored surfaces.
      current:
        "[--sparkle-core:currentColor] [--sparkle-satellite:color-mix(in_oklch,currentColor_60%,transparent)] [--sparkle-glow:transparent]",
    },
  },
  defaultVariants: { size: "md", tone: "brand" },
});

const SATELLITES = [
  { position: "top-[2%] right-[4%] size-[28%]", delay: "0s" },
  { position: "bottom-[6%] left-[2%] size-[22%]", delay: "-0.55s" },
  { position: "top-[14%] left-[4%] size-[14%]", delay: "-1.1s", hideOnXs: true },
];

export interface SparkleLoaderProps extends VariantProps<typeof sparkleLoaderVariants> {
  /** Accessible name announced to screen readers. */
  label?: string;
  /** Render `label` visibly beneath the sparkle. */
  showLabel?: boolean;
  /** Optional supporting line under the visible label. */
  description?: string;
  className?: string;
}

export function SparkleLoader({
  size = "md",
  tone = "brand",
  label = "Loading…",
  showLabel = false,
  description,
  className,
}: SparkleLoaderProps) {
  const isXs = size === "xs";
  const hasText = showLabel || !!description;

  const sparkle = (
    <span className={cn(sparkleLoaderVariants({ size, tone }), !hasText && className)} aria-hidden>
      {!isXs && (
        <span className="animate-sparkle-glow absolute inset-[18%] rounded-full bg-(--sparkle-glow) blur-md" />
      )}
      <Sparkle className="animate-sparkle-core absolute inset-0 m-auto size-[58%] text-(--sparkle-core)" />
      {SATELLITES.filter((s) => !(isXs && s.hideOnXs)).map((s) => (
        <Sparkle
          key={s.position}
          className={cn("animate-sparkle-twinkle absolute text-(--sparkle-satellite)", s.position)}
          style={{ animationDelay: s.delay }}
        />
      ))}
    </span>
  );

  if (!hasText) {
    return (
      <span role="status" className="inline-flex">
        {sparkle}
        <span className="sr-only">{label}</span>
      </span>
    );
  }

  return (
    <div role="status" className={cn("flex flex-col items-center gap-3 text-center", className)}>
      {sparkle}
      <div className="space-y-1">
        <p className={cn("text-sm font-medium text-foreground", !showLabel && "sr-only")}>{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
    </div>
  );
}

export { sparkleLoaderVariants };
