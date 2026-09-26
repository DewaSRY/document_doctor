"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useMotionValueEvent } from "motion/react";
import { useState } from "react";

interface Props {
  value: number;
  format: (value: number) => string;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({ value, format, className, duration = 0.6 }: Props) {
  const motionValue = useMotionValue(value);
  const [display, setDisplay] = useState(() => format(value));
  const previous = useRef(value);

  useMotionValueEvent(motionValue, "change", (latest) => {
    setDisplay(format(latest));
  });

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
    });
    previous.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <span className={className}>{display}</span>;
}
