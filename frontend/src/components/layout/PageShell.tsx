'use client';

import { cn } from '@/lib/utils';

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[1480px] space-y-8 px-5 py-8 sm:px-8 lg:px-10',
        className
      )}
    >
      {children}
    </div>
  );
}

export default PageShell;
