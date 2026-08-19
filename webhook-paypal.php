<?php
declare(strict_types=1);

/**
 * PayPal webhook endpoint.
 *
 * At developer.paypal.com add:
 *   https://your-domain/webhook-paypal.php
 * subscribing to PAYMENT.CAPTURE.* and BILLING.SUBSCRIPTION.* events, then
 * paste the webhook id into Admin -> Payments -> PayPal.
 *
 * Every event is verified with PayPal before it is trusted.
 */

require __DIR__ . '/app/bootstrap.php';

if (!Request::isPost()) {
    Response::json(['error' => 'POST only.'], 405);
}

if (!Payments::enabled('paypal')) {
    Response::json(['error' => 'PayPal is not configured.'], 503);
}

$event = json_decode(Request::body(), true);
if (!is_array($event) || empty($event['id'])) {
    Response::json(['error' => 'Malformed event.'], 400);
}

$headers = [
    'paypal-auth-algo'         => (string) ($_SERVER['HTTP_PAYPAL_AUTH_ALGO'] ?? ''),
    'paypal-cert-url'          => (string) ($_SERVER['HTTP_PAYPAL_CERT_URL'] ?? ''),
    'paypal-transmission-id'   => (string) ($_SERVER['HTTP_PAYPAL_TRANSMISSION_ID'] ?? ''),
    'paypal-transmission-sig'  => (string) ($_SERVER['HTTP_PAYPAL_TRANSMISSION_SIG'] ?? ''),
    'paypal-transmission-time' => (string) ($_SERVER['HTTP_PAYPAL_TRANSMISSION_TIME'] ?? ''),
];

if (!Payments::paypalWebhookValid($event, $headers)) {
    Response::json(['error' => 'Signature verification failed.'], 400);
}

$eventId = (string) $event['id'];
$type = (string) ($event['event_type'] ?? '');
$resource = $event['resource'] ?? [];

if (!Payments::beginWebhook('paypal', $eventId, $type, $event)) {
    Response::json(['received' => true, 'duplicate' => true]);
}

try {
    switch ($type) {
        case 'PAYMENT.CAPTURE.COMPLETED':
            Db::run(
                'UPDATE payments SET status = "succeeded", paid_at = UTC_TIMESTAMP()
                  WHERE provider = "paypal" AND provider_payment_id = ?',
                [(string) ($resource['id'] ?? '')]
            );
            break;

        case 'PAYMENT.CAPTURE.REFUNDED':
        case 'PAYMENT.CAPTURE.REVERSED':
            Db::run(
                'UPDATE payments SET status = "refunded" WHERE provider = "paypal" AND provider_payment_id = ?',
                [(string) ($resource['id'] ?? '')]
            );
            break;

        case 'BILLING.SUBSCRIPTION.CANCELLED':
        case 'BILLING.SUBSCRIPTION.EXPIRED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED':
            Db::run(
                'UPDATE subscriptions SET status = ?, canceled_at = UTC_TIMESTAMP()
                  WHERE provider = "paypal" AND provider_subscription_id = ?',
                [str_contains($type, 'CANCELLED') ? 'canceled' : 'expired', (string) ($resource['id'] ?? '')]
            );
            break;

        case 'BILLING.SUBSCRIPTION.ACTIVATED':
            Db::run(
                'UPDATE subscriptions SET status = "active" WHERE provider = "paypal" AND provider_subscription_id = ?',
                [(string) ($resource['id'] ?? '')]
            );
            break;
    }

    Payments::finishWebhook('paypal', $eventId);
    Response::json(['received' => true]);
} catch (Throwable $e) {
    Payments::finishWebhook('paypal', $eventId, $e->getMessage());
    Response::json(['error' => 'Handler failed.'], 500);
}
