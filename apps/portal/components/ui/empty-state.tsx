import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  title: string;
  description: string;
  hideImage?: boolean;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export default function EmptyState({
  title,
  description,
  hideImage = false,
  primaryAction,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`} data-testid="empty-state">
      {!hideImage && (
        <img
          className="w-32 mb-3 mx-auto"
          src="/images/empty-state.png"
          alt=""
        />
      )}
      <p className="font-bold text-center text-lg">{title}</p>
      <p className="text-sm text-center text-gray-500">{description}</p>
      {(primaryAction || secondaryAction) && (
        <div className="mt-6">
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="mr-3 border-gray-300"
            >
              {secondaryAction.label}
            </Button>
          )}
          {primaryAction && (
            <Button
              onClick={primaryAction.onClick}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {primaryAction.icon && (
                <primaryAction.icon className="h-4 w-4 mr-2" />
              )}
              {primaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
