'use client';

import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 border-b border-c2-border pb-8 lg:flex-row lg:items-end lg:justify-between lg:gap-6',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-c2-text sm:text-[26px] sm:leading-8">
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-c2-muted">{description}</p>
        )}
      </div>
      {action && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}

export default PageHeader;
