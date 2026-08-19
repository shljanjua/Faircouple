import type { Metadata } from 'next';
import { query, parseJson } from '@/lib/db';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import { PaymentsManager } from '@/components/admin/payments-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Payments', noIndex: true });
}

export default async function AdminPaymentsPage() {
  const [gateways, payments, webhooks] = await Promise.all([
    query<any>(`SELECT * FROM payment_gateways ORDER BY sort_order ASC`),
    query<any>(`SELECT * FROM payments ORDER BY created_at DESC LIMIT 60`),
    query<any>(
      `SELECT id, provider, event_type, status, error, created_at
         FROM webhook_events ORDER BY created_at DESC LIMIT 25`
    ),
  ]);

  // Never send stored secrets to the browser — only whether they exist.
  const safeGateways = gateways.map((gateway) => ({
    ...gateway,
    credentialsPresent: Object.fromEntries(
      Object.entries(parseJson<Record<string, unknown>>(gateway.credentials, {})).map(
        ([key, value]) => [key, Boolean(value && String(value).length > 0)]
      )
    ),
    credentials: undefined,
  }));

  return (
    <PaymentsManager
      gateways={safeGateways}
      payments={payments}
      webhooks={webhooks}
      siteUrl={SITE_URL}
    />
  );
}
