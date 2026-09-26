"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps extends HTMLMotionProps<"div"> {
  delay?: number;
  y?: number;
}

export function ScrollReveal({
  className,
  delay = 0,
  y = 16,
  ...props
}: ScrollRevealProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(className)}
      {...props}
    />
  );
}
