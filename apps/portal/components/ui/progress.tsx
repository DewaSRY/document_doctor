"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

function Progress({
  className,
  value = 0,
  max = 100,
  indeterminate = false,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  value?: number;
  max?: number;
  indeterminate?: boolean;
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className={cn(
          "bg-primary h-full flex-1 transition-all",
          indeterminate && "animate-progress-indeterminate",
        )}
        style={
          indeterminate
            ? undefined
            : { transform: `translateX(-${100 - percentage}%)` }
        }
      />
    </ProgressPrimitive.Root>
  );
}

export { Progress };
