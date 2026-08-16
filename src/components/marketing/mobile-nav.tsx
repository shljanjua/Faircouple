'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonClasses } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/fairness', label: 'Fairness framework' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/love-or-attraction', label: 'Love or attraction?' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function MobileNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-background">
          <div className="container flex h-16 items-center justify-between">
            <span className="font-display text-lg font-bold">Menu</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <nav className="container flex flex-col gap-1 py-4" aria-label="Mobile">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-3 py-3 text-base font-medium transition-colors hover:bg-secondary',
                  pathname === link.href && 'bg-secondary text-primary'
                )}
              >
                {link.label}
              </Link>
            ))}

            <div className="mt-4 flex items-center justify-between rounded-lg border border-border px-3 py-3">
              <span className="text-sm font-medium">Day / night mode</span>
              <ThemeToggle />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {signedIn ? (
                <Link href="/dashboard" className={buttonClasses('primary', 'lg')}>
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link href="/signup" className={buttonClasses('primary', 'lg')}>
                    Start free
                  </Link>
                  <Link href="/signin" className={buttonClasses('outline', 'lg')}>
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
