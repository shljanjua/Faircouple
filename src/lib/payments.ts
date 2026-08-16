import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';

export interface GatewayConfig {
  provider: 'stripe' | 'paypal' | 'manual';
  isEnabled: boolean;
  mode: string;
  credentials: Record<string, string>;
}

/**
 * Gateway credentials come from the admin panel first, falling back to
 * environment variables. That means the site can be reconfigured without a
 * redeploy, while still working from env vars alone.
 */
export async function getGateway(provider: 'stripe' | 'paypal'): Promise<GatewayConfig | null> {
  let row: any = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('payment_gateways')
      .select('*')
      .eq('provider', provider)
      .maybeSingle();
    row = data;
  } catch {
    row = null;
  }

  const credentials: Record<string, string> = { ...(row?.credentials ?? {}) };

  if (provider === 'stripe') {
    credentials.secret_key = credentials.secret_key || process.env.STRIPE_SECRET_KEY || '';
    credentials.publishable_key =
      credentials.publishable_key || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
    credentials.webhook_secret =
      credentials.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || '';
  } else {
    credentials.client_id = credentials.client_id || process.env.PAYPAL_CLIENT_ID || '';
    credentials.client_secret = credentials.client_secret || process.env.PAYPAL_CLIENT_SECRET || '';
    credentials.webhook_id = credentials.webhook_id || process.env.PAYPAL_WEBHOOK_ID || '';
  }

  const hasCredentials =
    provider === 'stripe' ? Boolean(credentials.secret_key) : Boolean(credentials.client_id);

  return {
    provider,
    isEnabled: row ? Boolean(row.is_enabled) && hasCredentials : hasCredentials,
    mode: row?.mode ?? (process.env.PAYPAL_ENV === 'live' ? 'live' : 'test'),
    credentials,
  };
}

export async function getStripe(): Promise<Stripe | null> {
  const gateway = await getGateway('stripe');
  if (!gateway?.credentials.secret_key) return null;
  return new Stripe(gateway.credentials.secret_key, {
    appInfo: { name: 'FairCouples', version: '1.0.0' },
  });
}

/* ----------------------------------------------------------------- PayPal */

export function paypalBaseUrl(mode: string) {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

export async function paypalAccessToken(): Promise<{ token: string; baseUrl: string } | null> {
  const gateway = await getGateway('paypal');
  if (!gateway?.credentials.client_id || !gateway.credentials.client_secret) return null;

  const baseUrl = paypalBaseUrl(gateway.mode);
  const auth = Buffer.from(
    `${gateway.credentials.client_id}:${gateway.credentials.client_secret}`
  ).toString('base64');

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) return null;
  return { token: json.access_token, baseUrl };
}

export async function createPaypalOrder(params: {
  amountCents: number;
  currency: string;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  referenceId: string;
}) {
  const auth = await paypalAccessToken();
  if (!auth) return { ok: false as const, error: 'PayPal is not configured.' };

  const response = await fetch(`${auth.baseUrl}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.referenceId,
          description: params.description.slice(0, 127),
          amount: {
            currency_code: params.currency,
            value: (params.amountCents / 100).toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'FairCouples',
        user_action: 'PAY_NOW',
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
      },
    }),
    cache: 'no-store',
  });

  const json = (await response.json()) as any;
  if (!response.ok) {
    return { ok: false as const, error: json?.message ?? 'PayPal order failed.' };
  }

  const approveUrl = (json.links ?? []).find((link: any) => link.rel === 'approve')?.href;
  return { ok: true as const, orderId: json.id as string, approveUrl: approveUrl as string };
}

export async function capturePaypalOrder(orderId: string) {
  const auth = await paypalAccessToken();
  if (!auth) return { ok: false as const, error: 'PayPal is not configured.' };

  const response = await fetch(`${auth.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const json = (await response.json()) as any;
  if (!response.ok) {
    return { ok: false as const, error: json?.message ?? 'PayPal capture failed.' };
  }
  return { ok: true as const, order: json };
}

/** Calculates the period end for a given billing interval. */
export function periodEnd(interval: string, from = new Date()) {
  const date = new Date(from);
  if (interval === 'year') date.setFullYear(date.getFullYear() + 1);
  else if (interval === 'lifetime') date.setFullYear(date.getFullYear() + 100);
  else date.setMonth(date.getMonth() + 1);
  return date;
}
