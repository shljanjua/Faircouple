import { NextResponse, type NextRequest } from 'next/server';
import { execute, queryOne, uuid, nowSql } from '@/lib/db';
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

  const existing = await queryOne<{ status: string }>(
    `SELECT status FROM webhook_events WHERE provider = 'paypal' AND event_id = ? LIMIT 1`,
    [event.id]
  );

  if (existing?.status === 'processed') {
    return NextResponse.json({ received: true, duplicate: true });
  }

  await execute(
    `INSERT INTO webhook_events (id, provider, event_id, event_type, payload, status)
     VALUES (?, 'paypal', ?, ?, ?, 'received')
     ON DUPLICATE KEY UPDATE event_type = VALUES(event_type), payload = VALUES(payload), status = 'received'`,
    [uuid(), event.id, event.event_type, JSON.stringify(event)]
  );

  try {
    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED': {
        await execute(
          `UPDATE payments SET status = 'succeeded', paid_at = ?
            WHERE provider = 'paypal' AND provider_payment_id = ?`,
          [nowSql(), event.resource.id]
        );
        break;
      }
      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.CAPTURE.REVERSED': {
        await execute(
          `UPDATE payments SET status = 'refunded'
            WHERE provider = 'paypal' AND provider_payment_id = ?`,
          [event.resource.id]
        );
        break;
      }
      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
      case 'BILLING.SUBSCRIPTION.SUSPENDED': {
        await execute(
          `UPDATE subscriptions SET status = ?, canceled_at = ?
            WHERE provider = 'paypal' AND provider_subscription_id = ?`,
          [
            String(event.event_type).includes('CANCELLED') ? 'canceled' : 'expired',
            nowSql(),
            event.resource.id,
          ]
        );
        break;
      }
      case 'BILLING.SUBSCRIPTION.ACTIVATED': {
        await execute(
          `UPDATE subscriptions SET status = 'active'
            WHERE provider = 'paypal' AND provider_subscription_id = ?`,
          [event.resource.id]
        );
        break;
      }
      default:
        break;
    }

    await execute(
      `UPDATE webhook_events SET status = 'processed', processed_at = ?
        WHERE provider = 'paypal' AND event_id = ?`,
      [nowSql(), event.id]
    );

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Handler failed';
    await execute(
      `UPDATE webhook_events SET status = 'failed', error = ?
        WHERE provider = 'paypal' AND event_id = ?`,
      [message, event.id]
    );
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
