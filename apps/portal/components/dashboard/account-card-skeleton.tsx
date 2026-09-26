"use client";

import { Card } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export function AccountCardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="flex-row items-start gap-2 px-4 py-2!">
          <Skeleton className="size-10 h-12 w-12 shrink-0 rounded-sm" />
          <div className="flex min-w-0 flex-1 flex-col items-end gap-3">
            <div className="flex w-full flex-col items-end gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-end gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-8" />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
