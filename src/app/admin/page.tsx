import type { Metadata } from 'next';
import Link from 'next/link';
import {
  AlertTriangle,
  CreditCard,
  Heart,
  Mail,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';
import { getGateway } from '@/lib/payments';
import { getAllSettings, settingString } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { Alert, Badge, Card, Stat, Table, Td, Th } from '@/components/ui';
import { formatMoney } from '@/lib/currency';
import { formatDate, timeAgo } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Admin dashboard', noIndex: true });
}

export default async function AdminDashboard() {
  const supabase = createAdminClient();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    users,
    newUsers,
    couples,
    activeSubs,
    payments,
    recentUsers,
    recentPayments,
    contacts,
    subscribers,
    failedEmails,
    settings,
    stripe,
    paypal,
  ] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart.toISOString()),
    supabase.from('couples').select('id', { count: 'exact', head: true }),
    supabase
      .from('subscriptions')
      .select('id, amount_cents, currency, interval', { count: 'exact' })
      .in('status', ['active', 'trialing']),
    supabase
      .from('payments')
      .select('amount_cents, currency, status, created_at')
      .eq('status', 'succeeded')
      .gte('created_at', monthStart.toISOString()),
    supabase
      .from('profiles')
      .select('id, email, full_name, country_code, currency, created_at, role')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('payments')
      .select('id, amount_cents, currency, status, provider, created_at, billing_email')
      .order('created_at', { ascending: false })
      .limit(8),
    supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new'),
    supabase
      .from('newsletter_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'subscribed'),
    supabase
      .from('email_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'failed'),
    getAllSettings(),
    getGateway('stripe'),
    getGateway('paypal'),
  ]);

  const monthRevenue = (payments.data ?? []).reduce(
    (sum: number, payment: any) => sum + (payment.amount_cents ?? 0),
    0
  );

  const mrr = (activeSubs.data ?? []).reduce((sum: number, subscription: any) => {
    const amount = subscription.amount_cents ?? 0;
    if (subscription.interval === 'year') return sum + Math.round(amount / 12);
    if (subscription.interval === 'lifetime') return sum;
    return sum + amount;
  }, 0);

  const warnings: string[] = [];
  if (!stripe?.isEnabled && !paypal?.isEnabled) {
    warnings.push('No payment gateway is enabled — nobody can subscribe yet.');
  }
  if (!settingString(settings, 'smtp_host')) {
    warnings.push('SMTP is not configured — verification and receipt emails will not send.');
  }
  if (!settingString(settings, 'analytics_ga4_id')) {
    warnings.push('Google Analytics 4 is not connected.');
  }
  if (settings.maintenance_mode === true) {
    warnings.push('Maintenance mode is ON — the public site is hidden from visitors.');
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything about FairCouples, controlled from here.
        </p>
      </header>

      {warnings.length > 0 && (
        <Alert tone="warning" title="Setup checklist">
          <ul className="mt-1 space-y-1">
            {warnings.map((warning) => (
              <li key={warning} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {warning}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total users"
          value={users.count ?? 0}
          hint={`${newUsers.count ?? 0} joined this month`}
          icon={<Users className="h-5 w-5" aria-hidden />}
        />
        <Stat
          label="Relationship spaces"
          value={couples.count ?? 0}
          icon={<Heart className="h-5 w-5" aria-hidden />}
        />
        <Stat
          label="Active subscriptions"
          value={activeSubs.count ?? 0}
          hint={`MRR ≈ ${formatMoney(mrr, 'USD', { showDecimals: false })}`}
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
        />
        <Stat
          label="Revenue this month"
          value={formatMoney(monthRevenue, 'USD', { showDecimals: false })}
          hint={`${(payments.data ?? []).length} successful payments`}
          icon={<CreditCard className="h-5 w-5" aria-hidden />}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center justify-between p-4">
          <span className="text-sm">
            <Mail className="mr-2 inline h-4 w-4" aria-hidden />
            New contact messages
          </span>
          <Link href="/admin/contacts" className="font-bold">
            {contacts.count ?? 0}
          </Link>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <span className="text-sm">
            <UserPlus className="mr-2 inline h-4 w-4" aria-hidden />
            Newsletter subscribers
          </span>
          <Link href="/admin/contacts" className="font-bold">
            {subscribers.count ?? 0}
          </Link>
        </Card>
        <Card className="flex items-center justify-between p-4">
          <span className="text-sm">
            <AlertTriangle className="mr-2 inline h-4 w-4" aria-hidden />
            Failed emails
          </span>
          <Link href="/admin/emails" className="font-bold">
            {failedEmails.count ?? 0}
          </Link>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Newest users</h2>
            <Link href="/admin/users" className="text-sm text-primary underline">
              View all
            </Link>
          </div>
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>User</Th>
                  <Th>Country</Th>
                  <Th>Joined</Th>
                </tr>
              </thead>
              <tbody>
                {(recentUsers.data ?? []).map((profile: any) => (
                  <tr key={profile.id}>
                    <Td>
                      <span className="font-medium">{profile.full_name ?? '—'}</span>
                      <span className="block text-xs text-muted-foreground">{profile.email}</span>
                    </Td>
                    <Td className="text-muted-foreground">
                      {profile.country_code ?? '—'} · {profile.currency}
                    </Td>
                    <Td className="text-muted-foreground">{timeAgo(profile.created_at)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Latest payments</h2>
            <Link href="/admin/payments" className="text-sm text-primary underline">
              View all
            </Link>
          </div>
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Customer</Th>
                  <Th>Provider</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {(recentPayments.data ?? []).map((payment: any) => (
                  <tr key={payment.id}>
                    <Td>
                      <span className="text-xs">{payment.billing_email ?? '—'}</span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(payment.created_at)}
                      </span>
                    </Td>
                    <Td className="capitalize text-muted-foreground">{payment.provider}</Td>
                    <Td>
                      <Badge tone={payment.status === 'succeeded' ? 'success' : 'danger'}>
                        {payment.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatMoney(payment.amount_cents, payment.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Integration status</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Stripe', ok: Boolean(stripe?.isEnabled), href: '/admin/payments' },
            { label: 'PayPal', ok: Boolean(paypal?.isEnabled), href: '/admin/payments' },
            { label: 'SMTP email', ok: Boolean(settingString(settings, 'smtp_host')), href: '/admin/emails' },
            {
              label: 'Google Analytics',
              ok: Boolean(settingString(settings, 'analytics_ga4_id')),
              href: '/admin/settings',
            },
            {
              label: 'Meta Pixel',
              ok: Boolean(settingString(settings, 'analytics_meta_pixel_id')),
              href: '/admin/settings',
            },
            {
              label: 'AdSense',
              ok: Boolean(settingString(settings, 'analytics_adsense_client')),
              href: '/admin/settings',
            },
            {
              label: 'Search Console',
              ok: Boolean(settingString(settings, 'seo_google_verification')),
              href: '/admin/seo',
            },
            {
              label: 'Google Ads',
              ok: Boolean(settingString(settings, 'analytics_google_ads_id')),
              href: '/admin/settings',
            },
          ].map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-secondary"
              >
                {item.label}
                <Badge tone={item.ok ? 'success' : 'outline'}>
                  {item.ok ? 'connected' : 'not set'}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
