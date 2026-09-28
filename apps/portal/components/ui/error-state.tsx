"use client";

import { ServerCrash, LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ErrorStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  className?: string;
}

export default function ErrorState({
  icon: Icon = ServerCrash,
  title,
  description,
  className = "",
}: ErrorStateProps) {
  const { t } = useTranslation("common");
  const resolvedTitle = title ?? t("error.title");
  const resolvedDescription = description ?? t("error.description");

  return (
    <div
      className={`flex flex-col items-center justify-center flex-1 py-12 text-center ${className}`}
      data-testid="error-state"
    >
      <Icon className="mx-auto h-12 w-12 text-gray-400" />
      <h3 className="mt-2 text-sm font-medium text-gray-900">
        {resolvedTitle}
      </h3>
      <p className="mt-1 text-sm text-gray-500">{resolvedDescription}</p>
    </div>
  );
}
