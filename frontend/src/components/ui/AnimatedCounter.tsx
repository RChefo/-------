'use client';

import { useEffect } from 'react';
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
  // springValue tracks motionValue with spring physics
  const springValue = useSpring(motionValue, {
    duration: duration * 1000,
    bounce: 0,
  });

  const displayValue = useTransform(springValue, (latest) => {
    const rounded = Math.round(latest);
    return formatValue ? formatValue(rounded) : rounded.toLocaleString();
  });

  useEffect(() => {
    // Setting motionValue causes springValue to animate toward it
    motionValue.set(value);
  }, [value, motionValue]);

  return (
    <motion.span className={className}>
      {displayValue}
    </motion.span>
  );
}

export default AnimatedCounter;
