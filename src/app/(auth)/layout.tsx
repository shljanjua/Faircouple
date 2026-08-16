import Link from 'next/link';
import { Logo } from '@/components/marketing/logo';
import { ThemeToggle } from '@/components/theme-toggle';

const PROOF = [
  'Both partners answer separately — nobody fills it in for two.',
  'Private entries are never shown to your partner.',
  'One subscription covers both of you.',
  'Pay in USD, GBP, EUR, CAD or AUD.',
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col">
        <header className="flex items-center justify-between p-6">
          <Logo />
          <ThemeToggle />
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="px-6 pb-6 text-center text-xs text-muted-foreground">
          <Link href="/privacy-policy" className="hover:text-primary">
            Privacy
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms-of-service" className="hover:text-primary">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link href="/contact" className="hover:text-primary">
            Support
          </Link>
        </footer>
      </div>

      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="grid-pattern absolute inset-0 opacity-10" aria-hidden />
        <div className="relative max-w-md">
          <h2 className="font-display text-4xl font-bold leading-tight">
            Relationships fail on imbalance long before they fail on love.
          </h2>
          <p className="mt-5 text-white/85">
            FairCouples turns invisible imbalance into something both people can see — effort,
            respect and loyalty, measured from both sides.
          </p>
          <ul className="mt-8 space-y-3">
            {PROOF.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/90">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
          <blockquote className="mt-10 border-l-2 border-white/40 pl-5 text-sm italic text-white/85">
            “We stopped arguing about who does more and started looking at the chart instead.”
            <footer className="mt-2 not-italic text-white/70">— Sarah &amp; James, Manchester</footer>
          </blockquote>
        </div>
      </aside>
    </div>
  );
}
