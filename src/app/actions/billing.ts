'use server';

import { revalidatePath } from 'next/cache';
import { execute, queryOne, nowSql } from '@/lib/db';
import { getSessionUser, isAdminRole } from '@/lib/auth';
import { getStripe, paypalAccessToken } from '@/lib/payments';
import { recordAudit } from '@/lib/audit';
import type { ActionResult } from '@/app/actions/couple';

export async function cancelSubscriptionAction(subscriptionId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const subscription = await queryOne<any>(
    `SELECT * FROM subscriptions WHERE id = ? LIMIT 1`,
    [subscriptionId]
  );

  if (!subscription) return { ok: false, error: 'Subscription not found.' };
  if (subscription.user_id !== user.id && !isAdminRole(user.profile.role)) {
    return { ok: false, error: 'You can only cancel your own subscription.' };
  }

  const provider = subscription.provider;
  const providerId = subscription.provider_subscription_id;

  if (provider === 'stripe' && providerId) {
    const stripe = await getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.update(providerId, { cancel_at_period_end: true });
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Stripe cancellation failed.',
        };
      }
    }
  }

  if (provider === 'paypal' && typeof providerId === 'string' && providerId.startsWith('I-')) {
    const auth = await paypalAccessToken();
    if (auth) {
      await fetch(`${auth.baseUrl}/v1/billing/subscriptions/${providerId}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Customer requested cancellation' }),
      });
    }
  }

  const result = await execute(
    `UPDATE subscriptions SET cancel_at_period_end = 1, canceled_at = ? WHERE id = ?`,
    [nowSql(), subscriptionId]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not cancel the subscription.' };

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: 'subscription.cancel',
    entityType: 'subscription',
    entityId: subscriptionId,
    summary: 'Cancelled at period end',
  });

  revalidatePath('/dashboard/billing');
  return {
    ok: true,
    message: 'Cancelled. You keep full access until the end of the current period.',
  };
}

export async function resumeSubscriptionAction(subscriptionId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const subscription = await queryOne<any>(
    `SELECT * FROM subscriptions WHERE id = ? LIMIT 1`,
    [subscriptionId]
  );

  if (!subscription) return { ok: false, error: 'Subscription not found.' };
  if (subscription.user_id !== user.id && !isAdminRole(user.profile.role)) {
    return { ok: false, error: 'You can only change your own subscription.' };
  }

  if (subscription.provider === 'stripe' && subscription.provider_subscription_id) {
    const stripe = await getStripe();
    if (stripe) {
      try {
        await stripe.subscriptions.update(subscription.provider_subscription_id, {
          cancel_at_period_end: false,
        });
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Stripe update failed.',
        };
      }
    }
  }

  const result = await execute(
    `UPDATE subscriptions SET cancel_at_period_end = 0, canceled_at = NULL WHERE id = ?`,
    [subscriptionId]
  );

  if (!result.ok) return { ok: false, error: result.error ?? 'Could not resume the subscription.' };

  revalidatePath('/dashboard/billing');
  return { ok: true, message: 'Subscription resumed.' };
}
