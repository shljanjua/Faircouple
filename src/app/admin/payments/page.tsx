import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import { PaymentsManager } from '@/components/admin/payments-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Payments', noIndex: true });
}

export default async function AdminPaymentsPage() {
  const supabase = createAdminClient();

  const [{ data: gateways }, { data: payments }, { data: webhooks }] = await Promise.all([
    supabase.from('payment_gateways').select('*').order('sort_order'),
    supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(60),
    supabase
      .from('webhook_events')
      .select('id, provider, event_type, status, error, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  // Never send stored secrets to the browser — only whether they exist.
  const safeGateways = ((gateways ?? []) as any[]).map((gateway) => ({
    ...gateway,
    credentialsPresent: Object.fromEntries(
      Object.entries(gateway.credentials ?? {}).map(([key, value]) => [
        key,
        Boolean(value && String(value).length > 0),
      ])
    ),
    credentials: undefined,
  }));

  return (
    <PaymentsManager
      gateways={safeGateways}
      payments={(payments ?? []) as any[]}
      webhooks={(webhooks ?? []) as any[]}
      siteUrl={SITE_URL}
    />
  );
}
