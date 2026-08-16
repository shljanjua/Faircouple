import Link from 'next/link';
import { getSessionUser } from '@/lib/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { ButtonLink } from '@/components/ui/button';
import { MobileNav } from '@/components/marketing/mobile-nav';
import { Logo } from '@/components/marketing/logo';

export const NAV_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/fairness', label: 'Fairness framework' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/love-or-attraction', label: 'Love or attraction?' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
];

export async function SiteHeader() {
  const user = await getSessionUser();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/85 backdrop-blur-lg">
      <div className="container flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:inline-flex" />
          {user ? (
            <ButtonLink href="/dashboard" size="sm" className="hidden sm:inline-flex">
              Dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink href="/signin" variant="ghost" size="sm" className="hidden sm:inline-flex">
                Sign in
              </ButtonLink>
              <ButtonLink href="/signup" size="sm" className="hidden sm:inline-flex">
                Start free
              </ButtonLink>
            </>
          )}
          <MobileNav signedIn={Boolean(user)} />
        </div>
      </div>
    </header>
  );
}
