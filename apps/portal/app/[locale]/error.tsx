"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation("common");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-1 items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <AlertTriangle className="size-6 text-destructive" aria-hidden />
          <CardTitle>{t("error.title")}</CardTitle>
          <CardDescription>{t("error.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={reset}>{t("tryAgain")}</Button>
        </CardContent>
      </Card>
    </main>
  );
}
