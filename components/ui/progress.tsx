import React, { createContext, useContext } from 'react';

type ProgressContextValue = {
  value: number;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) {
    throw new Error('Progress parts must be used within Progress');
  }
  return ctx;
}

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}

type ProgressProps = React.HTMLAttributes<HTMLDivElement> & {
  value?: number;
};

export function Progress({ value = 0, className, children, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <ProgressContext.Provider value={{ value: clamped }}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-valuetext={`${Math.round(clamped)}%`}
        data-slot="progress"
        className={cn('grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-2', className)}
        {...props}
      >
        {children}
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      </div>
    </ProgressContext.Provider>
  );
}

export function ProgressLabel({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      data-slot="progress-label"
      className={cn('text-sm font-medium text-text-primary-dark', className)}
      {...props}
    />
  );
}

export function ProgressValue({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  const { value } = useProgress();

  return (
    <span
      data-slot="progress-value"
      className={cn('text-sm tabular-nums text-text-secondary-dark', className)}
      {...props}
    >
      {Math.round(value)}%
    </span>
  );
}

export function ProgressTrack({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="progress-track"
      className={cn(
        'col-span-2 h-2 w-full overflow-hidden rounded-full bg-primary/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function ProgressIndicator({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const { value } = useProgress();

  return (
    <div
      data-slot="progress-indicator"
      className={cn('h-full bg-primary transition-all duration-300 ease-out', className)}
      style={{ width: `${value}%` }}
      {...props}
    />
  );
}
