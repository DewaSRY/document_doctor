import { cn } from "@/lib/utils";

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = "center",
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div
      className={cn(
        "flex max-w-2xl flex-col gap-3",
        align === "center" && "mx-auto items-center text-center",
      )}
    >
      <p className="text-sm font-semibold tracking-wide text-brand uppercase">
        {eyebrow}
      </p>
      <h2
        id={id}
        className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      {description && (
        <p className="text-base text-pretty text-muted-foreground sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}
