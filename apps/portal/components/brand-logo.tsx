import { cn } from "@/lib/utils";

/** Brand mascot: a platypus wearing a red doctor's hat. Decorative by
 *  default — pair it with a visible or sr-only name. The fur and bill colors
 *  are fixed (they're the character, not theme tokens); the hat uses the
 *  brand red so it tracks the palette. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden
      focusable="false"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-brand-soft" />
      {/* Head */}
      <circle cx="16" cy="19" r="8.5" fill="#9a6848" />
      <circle cx="12.6" cy="17.4" r="1.15" fill="#2a2522" />
      <circle cx="19.4" cy="17.4" r="1.15" fill="#2a2522" />
      <circle cx="13" cy="17" r="0.35" fill="white" />
      <circle cx="19.8" cy="17" r="0.35" fill="white" />
      {/* Bill */}
      <ellipse cx="16" cy="23.2" rx="7.6" ry="3.3" fill="#3f3a36" />
      <circle cx="14.6" cy="22.2" r="0.5" fill="#1f1b18" />
      <circle cx="17.4" cy="22.2" r="0.5" fill="#1f1b18" />
      {/* Red hat, tipped slightly */}
      <g transform="rotate(-10 16 11)">
        <ellipse
          cx="16"
          cy="11.6"
          rx="8.2"
          ry="1.7"
          className="fill-brand-700"
        />
        <path
          d="M11.2 11.4V5.6a1.6 1.6 0 0 1 1.6-1.6h6.4a1.6 1.6 0 0 1 1.6 1.6v5.8Z"
          className="fill-brand"
        />
        <path d="M11.2 9.4h9.6v1.9h-9.6Z" className="fill-brand-700" />
        <path
          d="M16 5.2v3M14.5 6.7h3"
          stroke="white"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export function BrandLogo({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-lg font-semibold tracking-tight">{name}</span>
    </span>
  );
}
