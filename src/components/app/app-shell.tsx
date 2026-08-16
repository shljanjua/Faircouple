'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  CalendarCheck,
  CreditCard,
  Gift,
  Heart,
  Images,
  ListChecks,
  LogOut,
  Menu,
  MessageCircle,
  Plane,
  Scale,
  Settings,
  Sparkles,
  Ticket,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/client';
import { ThemeToggle } from '@/components/theme-toggle';
import { Logo } from '@/components/marketing/logo';
import { Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import type { Couple, Profile } from '@/types';

const NAV_GROUPS: {
  label: string;
  items: { href: string; label: string; icon: typeof Heart }[];
}[] = [
  {
    label: 'Relationship',
    items: [
      { href: '/dashboard', label: 'Overview', icon: BarChart3 },
      { href: '/dashboard/fairness', label: 'Fairness', icon: Scale },
      { href: '/dashboard/emotions', label: 'Emotions', icon: Heart },
      { href: '/dashboard/checkin', label: 'Daily check-in', icon: CalendarCheck },
      { href: '/dashboard/compatibility', label: 'Compatibility', icon: Sparkles },
      { href: '/dashboard/checklists', label: 'Checklists', icon: ListChecks },
    ],
  },
  {
    label: 'Together',
    items: [
      { href: '/dashboard/messages', label: 'Messages', icon: MessageCircle },
      { href: '/dashboard/gallery', label: 'Photos', icon: Images },
      { href: '/dashboard/gifts', label: 'Gifts', icon: Gift },
    ],
  },
  {
    label: 'Money & travel',
    items: [
      { href: '/dashboard/budget', label: 'Budget', icon: Wallet },
      { href: '/dashboard/travel', label: 'Trips', icon: Plane },
      { href: '/dashboard/documents', label: 'Ticket vault', icon: Ticket },
    ],
  },
  {
    label: 'Account',
    items: [
      { href: '/dashboard/partner', label: 'Partner', icon: Users },
      { href: '/dashboard/billing', label: 'Billing', icon: CreditCard },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AppShell({
  children,
  profile,
  couple,
  partnerName,
  planName,
  isPaid,
}: {
  children: React.ReactNode;
  profile: Profile;
  couple: Couple | null;
  partnerName: string | null;
  planName: string;
  isPaid: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function signOut() {
    await getBrowserClient().auth.signOut();
    router.push('/signin');
    router.refresh();
  }

  const isAdmin = profile.role === 'admin' || profile.role === 'superadmin';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Logo href="/dashboard" />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Dashboard">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {isAdmin && (
          <div>
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Staff
            </p>
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Settings className="h-4 w-4" aria-hidden />
              Admin panel
            </Link>
          </div>
        )}
      </nav>

      <div className="border-t border-border p-3">
        {!isPaid && (
          <Link
            href="/pricing"
            className="mb-3 block rounded-lg bg-gradient-to-br from-rose-500 to-fuchsia-600 p-3 text-white"
          >
            <p className="text-sm font-semibold">Upgrade your plan</p>
            <p className="mt-0.5 text-xs text-white/85">
              Unlimited history, full reports and the itinerary generator.
            </p>
          </Link>
        )}
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar src={profile.avatar_url} name={profile.full_name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{profile.full_name ?? profile.email}</p>
            <p className="truncate text-xs text-muted-foreground">{planName}</p>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-secondary/20">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-background lg:block">
        {sidebar}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:px-8">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" aria-hidden />
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">
              {couple?.name || 'Your relationship space'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {partnerName ? `With ${partnerName}` : 'Invite your partner to unlock the full report'}
            </p>
          </div>

          {!isPaid && (
            <Badge tone="warning" className="hidden sm:inline-flex">
              Free plan
            </Badge>
          )}
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
