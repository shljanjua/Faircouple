<?php
declare(strict_types=1);

/** PayPal sends the buyer back here after approval; we capture and activate. */

$user = Auth::require();

$orderId  = Request::input('token');
$planSlug = Request::input('plan');
$interval = Request::input('interval', 'month');
$currency = Currency::normalise(Request::input('currency', 'USD'));

$fail = static function (string $message): never {
    Response::redirect('/dashboard/billing?checkout=failed&message=' . urlencode($message));
};

if ($orderId === '' || $planSlug === '') {
    $fail('Missing PayPal order details.');
}

$captured = Payments::paypalCapture($orderId);
if (!$captured['ok']) {
    $fail($captured['error'] ?? 'PayPal could not capture that payment.');
}

$order = $captured['data'];
if (($order['status'] ?? '') !== 'COMPLETED') {
    $fail('PayPal returned status ' . ($order['status'] ?? 'unknown') . '.');
}

$plan = Db::one('SELECT * FROM plans WHERE slug = ? LIMIT 1', [$planSlug]);
if (!$plan) {
    $fail('Plan not found.');
}

$price = Db::one(
    'SELECT * FROM plan_prices WHERE plan_id = ? AND currency = ? AND billing_interval = ? LIMIT 1',
    [$plan['id'], $currency, $interval]
);

$capture = $order['purchase_units'][0]['payments']['captures'][0] ?? [];
$amountCents = (int) round(((float) ($capture['amount']['value'] ?? 0)) * 100);

$start = time();
$end = Payments::periodEnd($interval, $start);

$subscriptionId = Payments::saveSubscription([
    'user_id'                  => $user['id'],
    'couple_id'                => Auth::coupleId(),
    'plan_id'                  => $plan['id'],
    'price_id'                 => $price['id'] ?? null,
    'provider'                 => 'paypal',
    'provider_subscription_id' => $orderId,
    'provider_customer_id'     => $order['payer']['payer_id'] ?? null,
    'status'                   => 'active',
    'currency'                 => $currency,
    'billing_interval'         => $interval,
    'amount_cents'             => $amountCents ?: (int) ($price['amount_cents'] ?? 0),
    'current_period_start'     => date('Y-m-d H:i:s', $start),
    'current_period_end'       => $end,
]);

Payments::savePayment([
    'user_id'             => $user['id'],
    'subscription_id'     => $subscriptionId,
    'provider'            => 'paypal',
    'provider_payment_id' => $capture['id'] ?? $orderId,
    'amount_cents'        => $amountCents,
    'currency'            => $currency,
    'status'              => 'succeeded',
    'description'         => Settings::text('site_name', 'FairCouples') . ' ' . $plan['name'] . ' — ' . $interval,
    'billing_email'       => $order['payer']['email_address'] ?? $user['email'],
    'paid_at'             => Str::now(),
    'metadata'            => ['order_id' => $orderId],
]);

Mailer::template('subscription-active', $user['email'], [
    'name'              => $user['full_name'] ?: 'there',
    'plan_name'         => $plan['name'],
    'amount'            => Currency::money($amountCents, $currency),
    'currency'          => $currency,
    'next_billing_date' => date('j F Y', strtotime($end)),
    'invoice_url'       => Config::siteUrl('/dashboard/billing'),
], $user['id']);

Audit::record('subscription.activate', 'subscription', $subscriptionId, 'PayPal payment captured for ' . $planSlug);

Flash::success('Payment received — your plan is active, for both of you.');
Response::redirect('/dashboard/billing?checkout=success&provider=paypal');
