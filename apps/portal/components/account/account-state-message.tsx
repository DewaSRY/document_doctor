"use client";

import { useTranslation } from "react-i18next";
import { Link } from "@/i18n/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function AccountStateMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const { t } = useTranslation("account");

  return (
    <main className="flex flex-1 items-center justify-center bg-background px-6 py-12">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard"
            className="text-sm font-medium underline underline-offset-4"
          >
            {t("returnToDashboard")}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
