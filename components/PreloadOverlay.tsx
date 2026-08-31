import React, { useEffect } from 'react';
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress';

type PreloadOverlayProps = {
  value: number;
  fading: boolean;
};

export function PreloadOverlay({ value, fading }: PreloadOverlayProps) {
  useEffect(() => {
    const splash = document.getElementById('app-preload');
    if (splash) {
      splash.setAttribute('hidden', '');
    }
  }, []);

  return (
    <div
      className={cn(
        'fixed inset-0 z-[10000] flex items-center justify-center bg-background-dark transition-opacity duration-200',
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      )}
      aria-hidden={fading}
    >
      <Progress value={value} className="w-full max-w-sm px-6">
        <ProgressLabel>Loading editor</ProgressLabel>
        <ProgressValue />
      </Progress>
    </div>
  );
}

function cn(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(' ');
}
