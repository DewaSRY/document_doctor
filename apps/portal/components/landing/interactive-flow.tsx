"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "motion/react";
import { cn } from "@/lib/utils";

const AUTO_ADVANCE_INTERVAL_MS = 2400;

export interface InteractiveFlowStep {
  title: string;
  summary: string;
  detail?: string;
}

interface InteractiveFlowProps {
  steps: InteractiveFlowStep[];
  className?: string;
}

export function InteractiveFlow({ steps, className }: InteractiveFlowProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = steps[activeIndex];

  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { amount: 0.4 });
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const stepStripRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isInView || steps.length < 2) return;

    const id = setInterval(() => {
      setActiveIndex((current) => (current + 1) % steps.length);
    }, AUTO_ADVANCE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [isInView, steps.length]);

  useEffect(() => {
    const strip = stepStripRef.current;
    const activeButton = stepRefs.current[activeIndex];
    if (!strip || !activeButton) return;

    const stripRect = strip.getBoundingClientRect();
    const buttonRect = activeButton.getBoundingClientRect();

    if (
      buttonRect.left < stripRect.left ||
      buttonRect.right > stripRect.right
    ) {
      const offset =
        buttonRect.left -
        stripRect.left -
        (stripRect.width - buttonRect.width) / 2;
      strip.scrollBy({ left: offset, behavior: "smooth" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className={cn("w-full", className)}>
      <div
        ref={stepStripRef}
        className="flex scroll-smooth flex-col gap-2 overflow-x-auto md:flex-row md:items-center md:gap-0 md:pb-2"
      >
        {steps.map((step, index) => (
          <div
            key={step.title}
            className="flex flex-col md:flex-row md:flex-none md:items-center p-2 "
          >
            <motion.button
              ref={(el) => {
                stepRefs.current[index] = el;
              }}
              type="button"
              onClick={() => setActiveIndex(index)}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              aria-pressed={index === activeIndex}
              className={cn(
                "flex h-40 min-w-50 flex-col items-center justify-center gap-1.5 rounded-2xl p-4 text-center ring-1 transition-colors md:h-36 md:w-36",
                index === activeIndex
                  ? "bg-primary/10 ring-primary/40"
                  : "bg-card ring-foreground/10 hover:bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold transition-colors",
                  index === activeIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {index + 1}
              </span>
              <p className="text-sm font-semibold text-balance whitespace-break-spaces">
                {step.title}
              </p>
              <p className="text-xs text-muted-foreground text-balance whitespace-break-spaces">
                {step.summary}
              </p>
            </motion.button>

            {index < steps.length - 1 && (
              <FlowConnector active={index < activeIndex} />
            )}
          </div>
        ))}
      </div>

      {active?.detail && (
        <motion.div layout className="mt-5 grid">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={active.title}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5 }}
              className="col-start-1 row-start-1 rounded-2xl bg-muted/90 p-5 text-sm leading-relaxed  text-muted-foreground ring-1 ring-foreground/5"
            >
              <p className="mb-1 text-lg font-semibold tracking-wide text-foreground uppercase">
                {active.title}
              </p>
              {active.detail}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

function FlowConnector({ active }: { active?: boolean }) {
  return (
    <div className="flex shrink-0 items-center justify-center py-1 md:px-1 md:py-0">
      <svg
        className="h-6 w-4 rotate-90 text-muted-foreground/40 md:h-4 md:w-6 md:rotate-0"
        viewBox="0 0 24 16"
        fill="none"
        aria-hidden
      >
        <path
          d="M1 8H21M21 8L15 2M21 8L15 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            "transition-colors duration-300",
            active && "text-primary/60",
          )}
        />
      </svg>
    </div>
  );
}
