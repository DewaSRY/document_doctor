"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SparkleIconLinkProps {
  href: string;
  ariaLabel: string;
  icon: ReactNode;
  hoverRotate?: "left" | "right";
}

export function SparkleIconLink({
  href,
  ariaLabel,
  icon,
  hoverRotate = "right",
}: SparkleIconLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className={cn(
        "group relative text-muted-foreground transition-colors hover:text-foreground",
      )}
    >
      <motion.span
        animate={{ scale: [0.7, 1.25, 0.7] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-2 -right-2.5"
      >
        <Sparkle className="size-2.5 fill-primary text-primary" aria-hidden />
      </motion.span>
      <motion.span
        animate={{ scale: [0.7, 1.25, 0.7] }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
        className="absolute -bottom-1.5 -left-2.5"
      >
        <Sparkle className="size-2 fill-primary/70 text-primary/70" aria-hidden />
      </motion.span>
      <span
        className={cn(
          "block transition-transform duration-300 group-hover:scale-110",
          hoverRotate === "right"
            ? "group-hover:rotate-6"
            : "group-hover:-rotate-6",
        )}
      >
        {icon}
      </span>
    </a>
  );
}
