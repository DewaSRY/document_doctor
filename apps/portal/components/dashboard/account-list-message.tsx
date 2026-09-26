"use client";

import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "../ui/card";

export function AccountListMessage({
  icon: Icon,
  className,
  children,
}: {
  icon: typeof Wallet;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex-col items-center gap-2 py-10 text-center">
      <Icon className={cn("size-6", className)} aria-hidden />
      <p className={cn("text-sm text-muted-foreground", className)}>
        {children}
      </p>
    </Card>
  );
}
