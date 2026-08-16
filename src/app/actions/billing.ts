'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth';
import { getStripe, paypalAccessToken } from '@/lib/payments';
import { recordAudit } from '@/lib/audit';
import type { ActionResult } from '@/app/actions/couple';

export async function cancelSubscriptionAction(subscriptionId: string): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: 'Not signed in.' };

  const supabase = createAdminClient();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!subscription) return { ok: false, error: 'Subscription not found.' };
  if ((subscription as any).user_id !== user.id && user.profile.role === 'user') {
    return { ok: false, error: 'You can only cancel your own subscription.' };
  }

  const provider = (subscription as any).provider;
  const providerId = (subscription as any).provider_subscription_id;

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

  if (provider === 'paypal' && providerId?.startsWith('I-')) {
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

  const { error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true, canceled_at: new Date().toISOString() })
    .eq('id', subscriptionId);

  if (error) return { ok: false, error: error.message };

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

  const supabase = createAdminClient();
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', subscriptionId)
    .maybeSingle();

  if (!subscription) return { ok: false, error: 'Subscription not found.' };

  if ((subscription as any).provider === 'stripe') {
    const stripe = await getStripe();
    if (stripe && (subscription as any).provider_subscription_id) {
      await stripe.subscriptions.update((subscription as any).provider_subscription_id, {
        cancel_at_period_end: false,
      });
    }
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: false, canceled_at: null })
    .eq('id', subscriptionId);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/dashboard/billing');
  return { ok: true, message: 'Subscription resumed.' };
}
