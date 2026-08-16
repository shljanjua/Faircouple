'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && resolvedTheme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to day mode' : 'Switch to night mode'}
      title={isDark ? 'Day mode' : 'Night mode'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'relative inline-flex h-9 w-16 shrink-0 items-center rounded-full border border-border bg-secondary transition-colors',
        'hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      <span
        className={cn(
          'absolute left-1 flex h-7 w-7 items-center justify-center rounded-full bg-card shadow transition-transform duration-300',
          isDark && 'translate-x-7'
        )}
      >
        {isDark ? (
          <Moon className="h-4 w-4 text-indigo-300" aria-hidden />
        ) : (
          <Sun className="h-4 w-4 text-amber-500" aria-hidden />
        )}
      </span>
      <span className="sr-only">Toggle day and night mode</span>
    </button>
  );
}
