"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

export function AuthBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-background">
      {/* Main ambient gradient */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        animate={{
          backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"],
        }}
        transition={{
          duration: 24,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        style={{
          backgroundImage: `
            radial-gradient(
              circle at 50% 40%,
              color-mix(in srgb, var(--brand) 18%, transparent),
              transparent 55%
            )
          `,
          backgroundSize: "140% 140%",
        }}
      />

      {/* Large center glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/15 blur-[100px] dark:bg-brand/8"
        animate={{
          scale: [0.8, 1.25, 0.8],
          opacity: [0.35, 0.75, 0.35],
        }}
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Left orb */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-[20%] size-[28rem] rounded-full bg-brand/20 blur-[90px] dark:bg-brand/10"
        animate={{
          x: [-30, 140, -30],
          y: [20, -80, 20],
          scale: [0.85, 1.15, 0.85],
          opacity: [0.35, 0.7, 0.35],
        }}
        transition={{
          duration: 16,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Right orb */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-40 bottom-[15%] size-[30rem] rounded-full bg-brand-300/20 blur-[100px] dark:bg-brand-300/10"
        animate={{
          x: [30, -140, 30],
          y: [-20, 90, -20],
          scale: [1, 0.8, 1],
          opacity: [0.3, 0.65, 0.3],
        }}
        transition={{
          duration: 19,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Top-right accent */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-brand/15 blur-[80px] dark:bg-brand/7"
        animate={{
          x: [0, -100, 0],
          y: [0, 80, 0],
          scale: [1, 1.3, 1],
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Slow orbital ring */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand/10 dark:border-brand/5"
        animate={{
          rotate: 360,
          scale: [0.95, 1.05, 0.95],
        }}
        transition={{
          rotate: {
            duration: 70,
            repeat: Infinity,
            ease: "linear",
          },
          scale: {
            duration: 14,
            repeat: Infinity,
            ease: "easeInOut",
          },
        }}
      />

      {/* Moving light sweep */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-1/2 top-0 h-full w-[70%] rotate-12 bg-gradient-to-r from-transparent via-brand/8 to-transparent blur-3xl dark:via-brand/4"
        animate={{
          x: ["-20%", "220%"],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          repeatDelay: 3,
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
