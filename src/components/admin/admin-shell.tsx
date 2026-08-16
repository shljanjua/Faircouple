'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  CreditCard,
  FileText,
  Gauge,
  Globe,
  Heart,
  LogOut,
  Mail,
  Megaphone,
  Menu,
  Package,
  Receipt,
  Search,
  Settings,
  ShieldCheck,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { signOutAction } from '@/app/actions/auth';
import { ThemeToggle } from '@/components/theme-toggle';
import { Avatar, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';

const NAV = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: Gauge }],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/couples', label: 'Relationship spaces', icon: Heart },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { href: '/admin/plans', label: 'Plans & pricing', icon: Package },
      { href: '/admin/subscriptions', label: 'Subscriptions', icon: BarChart3 },
      { href: '/admin/payments', label: 'Payments & gateways', icon: CreditCard },
      { href: '/admin/coupons', label: 'Coupons', icon: Ticket },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/blog', label: 'Blog', icon: FileText },
      { href: '/admin/pages', label: 'Legal & pages', icon: FileText },
      { href: '/admin/content', label: 'FAQ & testimonials', icon: Megaphone },
      { href: '/admin/destinations', label: 'Destinations', icon: Globe },
    ],
  },
  {
    label: 'Platform',
    items: [
      { href: '/admin/seo', label: 'SEO & redirects', icon: Search },
      { href: '/admin/emails', label: 'Email & SMTP', icon: Mail },
      { href: '/admin/contacts', label: 'Inbox & subscribers', icon: Receipt },
      { href: '/admin/settings', label: 'Settings & integrations', icon: Settings },
      { href: '/admin/audit', label: 'Audit log', icon: ShieldCheck },
    ],
  },
];

export function AdminShell({
  children,
  name,
  email,
  role,
  avatar,
}: {
  children: React.ReactNode;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white dark:bg-white dark:text-slate-900">
            FC
          </span>
          <span className="font-display text-base font-bold">Admin</span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} className="lg:hidden" aria-label="Close">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Admin">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
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
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar src={avatar} name={name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={async () => {
              await signOutAction();
              router.push('/signin');
              router.refresh();
            }}
            className="rounded-md p-2 text-muted-foreground hover:bg-secondary"
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
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-xl">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur lg:px-8">
          <button type="button" onClick={() => setOpen(true)} className="lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
          <div className="flex-1">
            <Badge tone={role === 'superadmin' ? 'primary' : 'info'}>{role}</Badge>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Back to app
          </Link>
          <ThemeToggle />
        </header>

        <main id="main" className="flex-1 px-4 py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
