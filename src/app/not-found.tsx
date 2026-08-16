import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/seo';
import { Logo } from '@/components/marketing/logo';
import { ButtonLink } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Page not found', noIndex: true });
}

const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/fairness', label: 'The fairness framework' },
  { href: '/destinations', label: 'Destination guides' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact support' },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
      <Logo />
      <p className="mt-10 text-7xl font-bold text-primary">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold">This page does not exist</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The link may be out of date, or the page may have moved. Here is where most people were
        heading.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/" size="lg">
          Back to the homepage
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="outline" size="lg">
          Go to my dashboard
        </ButtonLink>
      </div>

      <nav className="mt-10 flex flex-wrap justify-center gap-2" aria-label="Popular pages">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-border px-4 py-1.5 text-sm hover:bg-secondary"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
