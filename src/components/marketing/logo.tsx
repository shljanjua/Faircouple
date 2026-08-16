import Link from 'next/link';
import { cn } from '@/lib/utils';

export function Logo({ className, href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn('flex items-center gap-2 font-display', className)} aria-label="FairCouples home">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-fuchsia-600 text-white shadow-sm">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden>
          <path
            d="M12 20s-6.5-4.35-8.5-8A4.6 4.6 0 0 1 12 7.5 4.6 4.6 0 0 1 20.5 12c-2 3.65-8.5 8-8.5 8Z"
            fill="currentColor"
            opacity="0.9"
          />
          <path d="M4 15h16" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M8 13v4M16 13v4" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight">
        Fair<span className="text-primary">Couples</span>
      </span>
    </Link>
  );
}
