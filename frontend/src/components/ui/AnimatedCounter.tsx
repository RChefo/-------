'use client';

import { useEffect, useRef } from 'react';
import { useSpring, useTransform, motion, useMotionValue } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  formatValue?: (val: number) => string;
}

export function AnimatedCounter({
  value,
  duration = 1.5,
  className,
  formatValue,
}: AnimatedCounterProps) {
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });

  const displayValue = useTransform(springValue, (latest) => {
    const rounded = Math.round(latest);
    if (formatValue) return formatValue(rounded);
    return rounded.toLocaleString();
  });

  const prevValue = useRef(0);

  useEffect(() => {
    motionValue.set(prevValue.current);
    springValue.set(value);
    prevValue.current = value;
  }, [value, motionValue, springValue]);

  return (
    <motion.span className={className}>
      {displayValue}
    </motion.span>
  );
}

export default AnimatedCounter;
