'use client';

import React, { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value?: number | null;
  duration?: number; // ms, default 900
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 900,
  prefix = '',
  suffix = '',
  decimals = 0,
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<number | null>(() =>
    typeof value === 'number' ? value : null
  );

  useEffect(() => {
    if (value === undefined || value === null) {
      setDisplayValue(null);
      return;
    }

    const endVal = Number(value);
    if (isNaN(endVal)) {
      setDisplayValue(null);
      return;
    }

    // Respect prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplayValue(endVal);
      return;
    }

    if (endVal === 0) {
      setDisplayValue(0);
      return;
    }

    let startTimestamp: number | null = null;
    const startVal = 0;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);

      // Ease out quad: 1 - (1 - progress) * (1 - progress)
      const easeProgress = 1 - Math.pow(1 - progress, 2);
      const current = startVal + (endVal - startVal) * easeProgress;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
      }
    };

    animationFrameId = window.requestAnimationFrame(step);

    return () => {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [value, duration]);

  if (displayValue === null) {
    return null;
  }

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString();

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
