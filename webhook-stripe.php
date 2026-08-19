<?php
declare(strict_types=1);

/**
 * Stripe webhook endpoint.
 *
 * In Stripe -> Developers -> Webhooks, add:
 *   https://your-domain/webhook-stripe.php
 * and subscribe to: checkout.session.completed, customer.subscription.created,
 * customer.subscription.updated, customer.subscription.deleted, invoice.paid,
 * invoice.payment_failed, charge.refunded.
 *
 * Then paste the signing secret into Admin -> Payments -> Stripe.
 */

require __DIR__ . '/app/bootstrap.php';

if (!Request::isPost()) {
    Response::json(['error' => 'POST only.'], 405);
}

$gateway = Payments::gateway('stripe');
$signingSecret = $gateway['credentials']['webhook_secret'] ?? '';

if ($signingSecret === '') {
    Response::json(['error' => 'The Stripe webhook secret is not configured.'], 503);
}

$payload = Request::body();
$signature = (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');

if (!Payments::stripeSignatureValid($payload, $signature, $signingSecret)) {
    Response::json(['error' => 'Signature verification failed.'], 400);
}

$event = json_decode($payload, true);
if (!is_array($event) || empty($event['id'])) {
    Response::json(['error' => 'Malformed event.'], 400);
}

$eventId = (string) $event['id'];
$type = (string) ($event['type'] ?? '');
$object = $event['data']['object'] ?? [];

if (!Payments::beginWebhook('stripe', $eventId, $type, $event)) {
    Response::json(['received' => true, 'duplicate' => true]);
}

try {
    switch ($type) {
        case 'checkout.session.completed':
            handleCheckoutCompleted($object);
            break;

        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted':
            syncSubscription($object);
            break;

        case 'invoice.paid':
            recordInvoice($object, 'succeeded');
            break;

        case 'invoice.payment_failed':
            recordInvoice($object, 'failed');
            notifyFailure($object);
            break;

        case 'charge.refunded':
            $refunded = (int) ($object['amount_refunded'] ?? 0);
            $total = (int) ($object['amount'] ?? 0);
            Db::run(
                'UPDATE payments SET status = ?, refunded_cents = ?
                  WHERE provider = "stripe" AND provider_payment_id = ?',
                [$refunded >= $total ? 'refunded' : 'partially_refunded', $refunded, (string) ($object['payment_intent'] ?? '')]
            );
            break;
    }

    Payments::finishWebhook('stripe', $eventId);
    Response::json(['received' => true]);
} catch (Throwable $e) {
    Payments::finishWebhook('stripe', $eventId, $e->getMessage());
    Response::json(['error' => 'Handler failed.'], 500);
}

/* ------------------------------------------------------------------ Handlers */

function handleCheckoutCompleted(array $session): void
{
    $metadata = $session['metadata'] ?? [];
    $userId = $metadata['user_id'] ?? ($session['client_reference_id'] ?? '');
    if ($userId === '') {
        return;
    }

    $planId = $metadata['plan_id'] ?? null;
    $interval = $metadata['billing_interval'] ?? 'month';
    $currency = strtoupper((string) ($session['currency'] ?? $metadata['currency'] ?? 'USD'));
    $amount = (int) ($session['amount_total'] ?? 0);

    if (($session['mode'] ?? '') === 'subscription' && !empty($session['subscription'])) {
        $fetched = Payments::stripeGet('subscriptions/' . $session['subscription']);
        if ($fetched['ok']) {
            syncSubscription($fetched['data'], [
                'user_id'   => $userId,
                'couple_id' => $metadata['couple_id'] ?? null,
                'plan_id'   => $planId,
                'price_id'  => $metadata['price_id'] ?? null,
            ]);
        }
    } else {
        // A one-off lifetime purchase.
        Payments::saveSubscription([
            'user_id'                  => $userId,
            'couple_id'                => $metadata['couple_id'] ?? null,
            'plan_id'                  => $planId,
            'price_id'                 => $metadata['price_id'] ?? null,
            'provider'                 => 'stripe',
            'provider_subscription_id' => (string) $session['id'],
            'provider_customer_id'     => $session['customer'] ?? null,
            'status'                   => 'active',
            'currency'                 => $currency,
            'billing_interval'         => 'lifetime',
            'amount_cents'             => $amount,
            'current_period_start'     => Str::now(),
            'current_period_end'       => Payments::periodEnd('lifetime'),
        ]);
    }

    $subscriptionId = Db::value(
        'SELECT id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [$userId]
    );

    Payments::savePayment([
        'user_id'             => $userId,
        'subscription_id'     => $subscriptionId,
        'provider'            => 'stripe',
        'provider_payment_id' => (string) ($session['payment_intent'] ?? $session['id']),
        'provider_invoice_id' => $session['invoice'] ?? null,
        'amount_cents'        => $amount,
        'currency'            => $currency,
        'status'              => 'succeeded',
        'description'         => 'FairCouples checkout (' . $interval . ')',
        'billing_email'       => $session['customer_details']['email'] ?? null,
        'billing_country'     => $session['customer_details']['address']['country'] ?? null,
        'paid_at'             => Str::now(),
    ]);

    $profile = Db::one('SELECT email, full_name FROM profiles WHERE id = ? LIMIT 1', [$userId]);
    $plan = $planId ? Db::one('SELECT name FROM plans WHERE id = ? LIMIT 1', [$planId]) : null;

    if ($profile && $profile['email']) {
        Mailer::template('subscription-active', $profile['email'], [
            'name'              => $profile['full_name'] ?: 'there',
            'plan_name'         => $plan['name'] ?? 'your plan',
            'amount'            => Currency::money($amount, $currency),
            'currency'          => $currency,
            'next_billing_date' => $interval === 'lifetime' ? 'never — you own it' : 'in one billing period',
            'invoice_url'       => Config::siteUrl('/dashboard/billing'),
        ], $userId);
    }
}

function syncSubscription(array $subscription, array $overrides = []): void
{
    $metadata = $subscription['metadata'] ?? [];
    $userId = $overrides['user_id'] ?? ($metadata['user_id'] ?? '');
    if ($userId === '') {
        return;
    }

    $item = $subscription['items']['data'][0] ?? [];
    $price = $item['price'] ?? [];

    Payments::saveSubscription([
        'user_id'                  => $userId,
        'couple_id'                => $overrides['couple_id'] ?? ($metadata['couple_id'] ?? null),
        'plan_id'                  => $overrides['plan_id'] ?? ($metadata['plan_id'] ?? null),
        'price_id'                 => $overrides['price_id'] ?? ($metadata['price_id'] ?? null),
        'provider'                 => 'stripe',
        'provider_subscription_id' => (string) $subscription['id'],
        'provider_customer_id'     => $subscription['customer'] ?? null,
        'status'                   => (string) ($subscription['status'] ?? 'active'),
        'currency'                 => strtoupper((string) ($price['currency'] ?? 'USD')),
        'billing_interval'         => $price['recurring']['interval'] ?? 'month',
        'amount_cents'             => (int) ($price['unit_amount'] ?? 0),
        'trial_ends_at'            => stamp($subscription['trial_end'] ?? null),
        'current_period_start'     => stamp($subscription['current_period_start'] ?? null),
        'current_period_end'       => stamp($subscription['current_period_end'] ?? null),
        'cancel_at_period_end'     => !empty($subscription['cancel_at_period_end']),
        'canceled_at'              => stamp($subscription['canceled_at'] ?? null),
        'ended_at'                 => stamp($subscription['ended_at'] ?? null),
    ]);
}

function recordInvoice(array $invoice, string $status): void
{
    $subscription = !empty($invoice['subscription'])
        ? Db::one(
            'SELECT id, user_id FROM subscriptions WHERE provider = "stripe" AND provider_subscription_id = ? LIMIT 1',
            [(string) $invoice['subscription']]
        )
        : null;

    Payments::savePayment([
        'user_id'             => $subscription['user_id'] ?? null,
        'subscription_id'     => $subscription['id'] ?? null,
        'provider'            => 'stripe',
        'provider_payment_id' => (string) ($invoice['payment_intent'] ?? $invoice['id']),
        'provider_invoice_id' => (string) ($invoice['id'] ?? ''),
        'amount_cents'        => (int) ($invoice['amount_paid'] ?: ($invoice['amount_due'] ?? 0)),
        'currency'            => strtoupper((string) ($invoice['currency'] ?? 'USD')),
        'status'              => $status,
        'description'         => $invoice['lines']['data'][0]['description'] ?? 'Subscription renewal',
        'invoice_url'         => $invoice['hosted_invoice_url'] ?? null,
        'receipt_url'         => $invoice['invoice_pdf'] ?? null,
        'billing_email'       => $invoice['customer_email'] ?? null,
        'paid_at'             => $status === 'succeeded' ? Str::now() : null,
        'failure_reason'      => $status === 'failed' ? 'Card declined or expired' : null,
    ]);
}

function notifyFailure(array $invoice): void
{
    $email = $invoice['customer_email'] ?? '';
    if ($email === '') {
        return;
    }

    Mailer::template('payment-failed', $email, [
        'name'      => $invoice['customer_name'] ?? 'there',
        'plan_name' => $invoice['lines']['data'][0]['description'] ?? 'your plan',
        'retry_url' => Config::siteUrl('/dashboard/billing'),
    ]);
}

function stamp($unix): ?string
{
    return $unix ? gmdate('Y-m-d H:i:s', (int) $unix) : null;
}
