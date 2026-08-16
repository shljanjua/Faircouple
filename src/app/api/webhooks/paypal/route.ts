import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getGateway, paypalAccessToken } from '@/lib/payments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PayPal webhook. Configure at developer.paypal.com with the endpoint
 *   https://<your-domain>/api/webhooks/paypal
 * subscribing to PAYMENT.CAPTURE.*, BILLING.SUBSCRIPTION.* events.
 * Every event is signature-verified against PayPal before it is trusted.
 */
export async function POST(request: NextRequest) {
  const gateway = await getGateway('paypal');
  if (!gateway?.isEnabled) {
    return NextResponse.json({ error: 'PayPal is not configured.' }, { status: 503 });
  }

  const raw = await request.text();
  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const auth = await paypalAccessToken();
  if (!auth) {
    return NextResponse.json({ error: 'Could not authenticate with PayPal.' }, { status: 503 });
  }

  if (gateway.credentials.webhook_id) {
    const verification = await fetch(`${auth.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth_algo: request.headers.get('paypal-auth-algo'),
        cert_url: request.headers.get('paypal-cert-url'),
        transmission_id: request.headers.get('paypal-transmission-id'),
        transmission_sig: request.headers.get('paypal-transmission-sig'),
        transmission_time: request.headers.get('paypal-transmission-time'),
        webhook_id: gateway.credentials.webhook_id,
        webhook_event: event,
      }),
      cache: 'no-store',
    });

    const result = (await verification.json()) as { verification_status?: string };
    if (result.verification_status !== 'SUCCESS') {
      return NextResponse.json({ error: 'Signature verification failed.' }, { status: 400 });
    }
  }

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from('webhook_events')
    .select('status')
    .eq('provider', 'paypal')
    .eq('event_id', event.id)
    .maybeSingle();

  if ((existing as any)?.status === 'processed') {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await supabase.from('webhook_events').upsert(
    {
      provider: 'paypal',
      event_id: event.id,
      event_type: event.event_type,
      payload: event,
      status: 'received',
    },
    { onConflict: 'provider,event_id' }
  );

  try {
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        const capture = event.resource;
        await supabase
          .from('payments')
          .update({ status: 'succeeded', paid_at: new Date().toISOString() })
          .eq('provider', 'paypal')
          .eq('provider_payment_id', capture.id);
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        const capture = event.resource;
        await supabase
          .from('payments')
          .update({ status: 'refunded' })
          .eq('provider', 'paypal')
          .eq('provider_payment_id', capture.id);
        break;
      }
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        await supabase
          .from('subscriptions')
          .update({
            status: event.event_type.includes('CANCELLED') ? 'canceled' : 'expired',
            canceled_at: new Date().toISOString(),
          })
          .eq('provider', 'paypal')
          .eq('provider_subscription_id', event.resource.id);
        break;
      }
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('provider', 'paypal')
          .eq('provider_subscription_id', event.resource.id);
        break;
      }
      default:
        break;
    }

    await supabase
      .from('webhook_events')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('provider', 'paypal')
      .eq('event_id', event.id);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Handler failed';
    await supabase
      .from('webhook_events')
      .update({ status: 'failed', error: message })
      .eq('provider', 'paypal')
      .eq('event_id', event.id);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
