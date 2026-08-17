<?php
declare(strict_types=1);

/**
 * Stripe and PayPal over their REST APIs with cURL — no SDKs, so nothing has
 * to be installed on the server. Credentials live in `payment_gateways` and are
 * entered in Admin -> Payments; they are never sent back to the browser.
 */
final class Payments
{
    private static array $gateways = [];

    /** @return array{provider:string,enabled:bool,mode:string,credentials:array,instructions:?string}|null */
    public static function gateway(string $provider): ?array
    {
        if (isset(self::$gateways[$provider])) {
            return self::$gateways[$provider];
        }

        $row = Db::one('SELECT * FROM payment_gateways WHERE provider = ? LIMIT 1', [$provider]);
        if (!$row) {
            return self::$gateways[$provider] = null;
        }

        return self::$gateways[$provider] = [
            'provider'     => $provider,
            'enabled'      => Str::bool($row['is_enabled']),
            'mode'         => (string) $row['mode'],
            'credentials'  => Str::json($row['credentials']),
            'instructions' => $row['instructions'],
        ];
    }

    public static function enabled(string $provider): bool
    {
        $gateway = self::gateway($provider);
        if (!$gateway || !$gateway['enabled']) {
            return false;
        }

        return match ($provider) {
            'stripe' => ($gateway['credentials']['secret_key'] ?? '') !== '',
            'paypal' => ($gateway['credentials']['client_id'] ?? '') !== ''
                        && ($gateway['credentials']['client_secret'] ?? '') !== '',
            default  => true,
        };
    }

    public static function anyEnabled(): bool
    {
        return self::enabled('stripe') || self::enabled('paypal') || self::enabled('manual');
    }

    /* ---------------------------------------------------------------- Stripe */

    /** Creates a Stripe Checkout Session and returns its URL. */
    public static function stripeCheckout(array $plan, array $price, array $user, ?string $coupleId): array
    {
        $gateway = self::gateway('stripe');
        $secret = $gateway['credentials']['secret_key'] ?? '';

        if (!self::enabled('stripe') || $secret === '') {
            return ['ok' => false, 'error' => 'Card payments are not switched on yet.'];
        }

        $interval = (string) $price['billing_interval'];
        $isLifetime = $interval === 'lifetime';
        $currency = strtolower((string) $price['currency']);

        $form = [
            'mode'                          => $isLifetime ? 'payment' : 'subscription',
            'success_url'                   => Config::siteUrl('/dashboard/billing?checkout=success&provider=stripe'),
            'cancel_url'                    => Config::siteUrl('/pricing?checkout=cancelled'),
            'client_reference_id'           => $user['id'],
            'customer_email'                => $user['email'],
            'allow_promotion_codes'         => 'true',
            'billing_address_collection'    => 'auto',
            'metadata[user_id]'             => $user['id'],
            'metadata[couple_id]'           => (string) $coupleId,
            'metadata[plan_id]'             => $plan['id'],
            'metadata[plan_slug]'           => $plan['slug'],
            'metadata[price_id]'            => $price['id'],
            'metadata[billing_interval]'    => $interval,
            'metadata[currency]'            => strtoupper($currency),
        ];

        if (!empty($price['stripe_price_id'])) {
            $form['line_items[0][price]'] = $price['stripe_price_id'];
            $form['line_items[0][quantity]'] = 1;
        } else {
            $form['line_items[0][quantity]'] = 1;
            $form['line_items[0][price_data][currency]'] = $currency;
            $form['line_items[0][price_data][unit_amount]'] = (int) $price['amount_cents'];
            $form['line_items[0][price_data][product_data][name]'] =
                Settings::text('site_name', 'FairCouples') . ' ' . $plan['name'];

            if (!$isLifetime) {
                $form['line_items[0][price_data][recurring][interval]'] = $interval;
            }
        }

        if (!$isLifetime) {
            $form['subscription_data[metadata][user_id]'] = $user['id'];
            $form['subscription_data[metadata][couple_id]'] = (string) $coupleId;
            $form['subscription_data[metadata][plan_id]'] = $plan['id'];
            $form['subscription_data[metadata][price_id]'] = $price['id'];

            if ((int) ($plan['trial_days'] ?? 0) > 0) {
                $form['subscription_data[trial_period_days]'] = (int) $plan['trial_days'];
            }
        }

        $response = self::curl(
            'POST',
            'https://api.stripe.com/v1/checkout/sessions',
            http_build_query($form),
            [
                'Authorization: Bearer ' . $secret,
                'Content-Type: application/x-www-form-urlencoded',
                'Stripe-Version: 2024-06-20',
            ]
        );

        if (!$response['ok']) {
            return ['ok' => false, 'error' => $response['error']];
        }

        $url = $response['data']['url'] ?? null;
        if (!$url) {
            return ['ok' => false, 'error' => 'Stripe did not return a checkout link.'];
        }

        return ['ok' => true, 'url' => $url];
    }

    /** Verifies the `Stripe-Signature` header against the signing secret. */
    public static function stripeSignatureValid(string $payload, string $header, string $secret): bool
    {
        if ($secret === '' || $header === '') {
            return false;
        }

        $timestamp = null;
        $signatures = [];

        foreach (explode(',', $header) as $part) {
            [$key, $value] = array_pad(explode('=', trim($part), 2), 2, '');
            if ($key === 't') {
                $timestamp = $value;
            } elseif ($key === 'v1') {
                $signatures[] = $value;
            }
        }

        if ($timestamp === null || $signatures === []) {
            return false;
        }

        // Reject anything older than five minutes to stop replays.
        if (abs(time() - (int) $timestamp) > 300) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp . '.' . $payload, $secret);
        foreach ($signatures as $signature) {
            if (hash_equals($expected, $signature)) {
                return true;
            }
        }

        return false;
    }

    public static function stripeGet(string $path): array
    {
        $secret = self::gateway('stripe')['credentials']['secret_key'] ?? '';
        if ($secret === '') {
            return ['ok' => false, 'error' => 'Stripe is not configured.'];
        }

        return self::curl('GET', 'https://api.stripe.com/v1/' . ltrim($path, '/'), null, [
            'Authorization: Bearer ' . $secret,
        ]);
    }

    public static function stripePost(string $path, array $form): array
    {
        $secret = self::gateway('stripe')['credentials']['secret_key'] ?? '';
        if ($secret === '') {
            return ['ok' => false, 'error' => 'Stripe is not configured.'];
        }

        return self::curl('POST', 'https://api.stripe.com/v1/' . ltrim($path, '/'), http_build_query($form), [
            'Authorization: Bearer ' . $secret,
            'Content-Type: application/x-www-form-urlencoded',
        ]);
    }

    /* ---------------------------------------------------------------- PayPal */

    public static function paypalBase(): string
    {
        $mode = self::gateway('paypal')['mode'] ?? 'test';
        return $mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
    }

    /** @return array{ok:bool,token?:string,error?:string} */
    public static function paypalToken(): array
    {
        $gateway = self::gateway('paypal');
        $clientId = $gateway['credentials']['client_id'] ?? '';
        $secret = $gateway['credentials']['client_secret'] ?? '';

        if ($clientId === '' || $secret === '') {
            return ['ok' => false, 'error' => 'PayPal is not configured.'];
        }

        $response = self::curl(
            'POST',
            self::paypalBase() . '/v1/oauth2/token',
            'grant_type=client_credentials',
            [
                'Authorization: Basic ' . base64_encode($clientId . ':' . $secret),
                'Content-Type: application/x-www-form-urlencoded',
            ]
        );

        if (!$response['ok'] || empty($response['data']['access_token'])) {
            return ['ok' => false, 'error' => $response['error'] ?? 'PayPal refused the credentials.'];
        }

        return ['ok' => true, 'token' => (string) $response['data']['access_token']];
    }

    /** Creates a PayPal order and returns the approval URL. */
    public static function paypalOrder(array $plan, array $price, array $user): array
    {
        if (!self::enabled('paypal')) {
            return ['ok' => false, 'error' => 'PayPal is not switched on yet.'];
        }

        $auth = self::paypalToken();
        if (!$auth['ok']) {
            return ['ok' => false, 'error' => $auth['error']];
        }

        $amount = number_format(((int) $price['amount_cents']) / 100, 2, '.', '');
        $interval = (string) $price['billing_interval'];

        $body = [
            'intent'         => 'CAPTURE',
            'purchase_units' => [[
                'reference_id' => $user['id'] . ':' . $plan['id'] . ':' . $price['id'],
                'description'  => mb_substr(Settings::text('site_name', 'FairCouples') . ' ' . $plan['name'] . ' — ' . $interval, 0, 120),
                'amount'       => ['currency_code' => strtoupper((string) $price['currency']), 'value' => $amount],
            ]],
            'application_context' => [
                'brand_name'          => Settings::text('site_name', 'FairCouples'),
                'user_action'         => 'PAY_NOW',
                'shipping_preference' => 'NO_SHIPPING',
                'return_url'          => Config::siteUrl('/checkout/paypal-return?plan=' . $plan['slug']
                                            . '&interval=' . $interval . '&currency=' . $price['currency']),
                'cancel_url'          => Config::siteUrl('/pricing?checkout=cancelled'),
            ],
        ];

        $response = self::curl(
            'POST',
            self::paypalBase() . '/v2/checkout/orders',
            json_encode($body),
            ['Authorization: Bearer ' . $auth['token'], 'Content-Type: application/json']
        );

        if (!$response['ok']) {
            return ['ok' => false, 'error' => $response['error']];
        }

        foreach ($response['data']['links'] ?? [] as $link) {
            if (($link['rel'] ?? '') === 'approve') {
                return ['ok' => true, 'url' => $link['href'], 'order_id' => $response['data']['id'] ?? null];
            }
        }

        return ['ok' => false, 'error' => 'PayPal did not return an approval link.'];
    }

    public static function paypalCapture(string $orderId): array
    {
        $auth = self::paypalToken();
        if (!$auth['ok']) {
            return ['ok' => false, 'error' => $auth['error']];
        }

        return self::curl(
            'POST',
            self::paypalBase() . '/v2/checkout/orders/' . rawurlencode($orderId) . '/capture',
            '{}',
            ['Authorization: Bearer ' . $auth['token'], 'Content-Type: application/json']
        );
    }

    /** Asks PayPal to confirm a webhook really came from them. */
    public static function paypalWebhookValid(array $event, array $headers): bool
    {
        $webhookId = self::gateway('paypal')['credentials']['webhook_id'] ?? '';
        if ($webhookId === '') {
            // Without a webhook id there is nothing to verify against, so the
            // event is refused rather than trusted.
            return false;
        }

        $auth = self::paypalToken();
        if (!$auth['ok']) {
            return false;
        }

        $response = self::curl(
            'POST',
            self::paypalBase() . '/v1/notifications/verify-webhook-signature',
            json_encode([
                'auth_algo'         => $headers['paypal-auth-algo'] ?? '',
                'cert_url'          => $headers['paypal-cert-url'] ?? '',
                'transmission_id'   => $headers['paypal-transmission-id'] ?? '',
                'transmission_sig'  => $headers['paypal-transmission-sig'] ?? '',
                'transmission_time' => $headers['paypal-transmission-time'] ?? '',
                'webhook_id'        => $webhookId,
                'webhook_event'     => $event,
            ]),
            ['Authorization: Bearer ' . $auth['token'], 'Content-Type: application/json']
        );

        return ($response['data']['verification_status'] ?? '') === 'SUCCESS';
    }

    public static function paypalCancelSubscription(string $subscriptionId): bool
    {
        $auth = self::paypalToken();
        if (!$auth['ok']) {
            return false;
        }

        $response = self::curl(
            'POST',
            self::paypalBase() . '/v1/billing/subscriptions/' . rawurlencode($subscriptionId) . '/cancel',
            json_encode(['reason' => 'Customer requested cancellation']),
            ['Authorization: Bearer ' . $auth['token'], 'Content-Type: application/json']
        );

        return $response['ok'];
    }

    /* ----------------------------------------------------------- Persistence */

    /** Writes (or refreshes) a subscription row keyed by provider + id. */
    public static function saveSubscription(array $row): ?string
    {
        Db::run(
            'INSERT INTO subscriptions
               (id, user_id, couple_id, plan_id, price_id, provider, provider_subscription_id,
                provider_customer_id, status, currency, billing_interval, amount_cents,
                trial_ends_at, current_period_start, current_period_end,
                cancel_at_period_end, canceled_at, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               couple_id            = VALUES(couple_id),
               plan_id              = COALESCE(VALUES(plan_id), plan_id),
               price_id             = VALUES(price_id),
               provider_customer_id = VALUES(provider_customer_id),
               status               = VALUES(status),
               currency             = VALUES(currency),
               billing_interval     = VALUES(billing_interval),
               amount_cents         = VALUES(amount_cents),
               trial_ends_at        = VALUES(trial_ends_at),
               current_period_start = VALUES(current_period_start),
               current_period_end   = VALUES(current_period_end),
               cancel_at_period_end = VALUES(cancel_at_period_end),
               canceled_at          = VALUES(canceled_at),
               ended_at             = VALUES(ended_at)',
            [
                Str::uuid(),
                $row['user_id'],
                $row['couple_id'] ?? null,
                $row['plan_id'] ?? null,
                $row['price_id'] ?? null,
                $row['provider'],
                $row['provider_subscription_id'],
                $row['provider_customer_id'] ?? null,
                $row['status'] ?? 'active',
                strtoupper((string) ($row['currency'] ?? 'USD')),
                $row['billing_interval'] ?? 'month',
                (int) ($row['amount_cents'] ?? 0),
                $row['trial_ends_at'] ?? null,
                $row['current_period_start'] ?? null,
                $row['current_period_end'] ?? null,
                !empty($row['cancel_at_period_end']) ? 1 : 0,
                $row['canceled_at'] ?? null,
                $row['ended_at'] ?? null,
            ]
        );

        return Db::value(
            'SELECT id FROM subscriptions WHERE provider = ? AND provider_subscription_id = ? LIMIT 1',
            [$row['provider'], $row['provider_subscription_id']]
        );
    }

    public static function savePayment(array $row): void
    {
        Db::run(
            'INSERT INTO payments
               (id, user_id, subscription_id, provider, provider_payment_id, provider_invoice_id,
                amount_cents, currency, status, description, receipt_url, invoice_url,
                billing_email, billing_country, paid_at, failure_reason, metadata)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               subscription_id = VALUES(subscription_id),
               amount_cents    = VALUES(amount_cents),
               status          = VALUES(status),
               receipt_url     = VALUES(receipt_url),
               invoice_url     = VALUES(invoice_url),
               paid_at         = VALUES(paid_at),
               failure_reason  = VALUES(failure_reason)',
            [
                Str::uuid(),
                $row['user_id'] ?? null,
                $row['subscription_id'] ?? null,
                $row['provider'],
                $row['provider_payment_id'],
                $row['provider_invoice_id'] ?? null,
                (int) ($row['amount_cents'] ?? 0),
                strtoupper((string) ($row['currency'] ?? 'USD')),
                $row['status'] ?? 'succeeded',
                $row['description'] ?? null,
                $row['receipt_url'] ?? null,
                $row['invoice_url'] ?? null,
                $row['billing_email'] ?? null,
                $row['billing_country'] ?? null,
                $row['paid_at'] ?? null,
                $row['failure_reason'] ?? null,
                isset($row['metadata']) ? json_encode($row['metadata']) : null,
            ]
        );
    }

    /**
     * Records a webhook and reports whether it is new.
     *
     * @return bool false when the event was already processed
     */
    public static function beginWebhook(string $provider, string $eventId, string $type, array $payload): bool
    {
        $existing = Db::value(
            'SELECT status FROM webhook_events WHERE provider = ? AND event_id = ? LIMIT 1',
            [$provider, $eventId]
        );

        if ($existing === 'processed') {
            return false;
        }

        Db::run(
            'INSERT INTO webhook_events (id, provider, event_id, event_type, payload, status)
             VALUES (?, ?, ?, ?, ?, "received")
             ON DUPLICATE KEY UPDATE event_type = VALUES(event_type), payload = VALUES(payload), status = "received"',
            [Str::uuid(), $provider, $eventId, $type, json_encode($payload)]
        );

        return true;
    }

    public static function finishWebhook(string $provider, string $eventId, ?string $error = null): void
    {
        Db::run(
            'UPDATE webhook_events SET status = ?, error = ?, processed_at = UTC_TIMESTAMP()
              WHERE provider = ? AND event_id = ?',
            [$error === null ? 'processed' : 'failed', $error, $provider, $eventId]
        );
    }

    /** Period end for a manual or PayPal subscription. */
    public static function periodEnd(string $interval, ?int $from = null): string
    {
        $from ??= time();

        return match ($interval) {
            'year'     => date('Y-m-d H:i:s', strtotime('+1 year', $from)),
            'lifetime' => date('Y-m-d H:i:s', strtotime('+100 years', $from)),
            default    => date('Y-m-d H:i:s', strtotime('+1 month', $from)),
        };
    }

    /* ------------------------------------------------------------------ cURL */

    /** @return array{ok:bool,data:array,status:int,error:?string} */
    private static function curl(string $method, string $url, ?string $body, array $headers): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'data' => [], 'status' => 0, 'error' => 'The cURL extension is not available on this server.'];
        }

        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 30,
            CURLOPT_CONNECTTIMEOUT => 12,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        $raw = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $curlError = curl_error($handle);
        curl_close($handle);

        if ($raw === false) {
            return ['ok' => false, 'data' => [], 'status' => 0, 'error' => $curlError ?: 'The request failed.'];
        }

        $data = json_decode((string) $raw, true);
        $data = is_array($data) ? $data : [];

        if ($status >= 400) {
            $message = $data['error']['message']
                ?? $data['message']
                ?? $data['error_description']
                ?? ('The payment provider returned HTTP ' . $status . '.');
            return ['ok' => false, 'data' => $data, 'status' => $status, 'error' => (string) $message];
        }

        return ['ok' => true, 'data' => $data, 'status' => $status, 'error' => null];
    }
}
