import { cn } from "@/lib/utils";
import React from "react";

interface LoadingDotProps {
  message?: string;
  description?: string;
  className?: string;
}

const LoadingDot = ({ message, description, className }: LoadingDotProps) => {
  const effectiveMessage = message ?? "";
  const effectiveDescription = description ?? "";

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-center space-x-2 mb-3">
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
      </div>
      <p className="text-center text-base font-medium">{effectiveMessage}</p>
      {effectiveDescription && (
        <p className="text-center text-xs text-gray-500">
          {effectiveDescription}
        </p>
      )}
    </div>
  );
};

export default LoadingDot;
