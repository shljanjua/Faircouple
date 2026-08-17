<?php
declare(strict_types=1);

/**
 * Sends the transactional emails. Templates live in `email_templates` and are
 * editable in Admin -> Emails; `{{placeholders}}` are replaced from a variable
 * map. Every attempt is written to `email_logs`.
 */
final class Mailer
{
    /** @return array{ok:bool,error:?string} */
    public static function send(
        string $to,
        string $subject,
        string $html,
        string $text = '',
        ?string $userId = null,
        ?string $templateSlug = null
    ): array {
        if (!Settings::bool('email_enabled', true)) {
            self::log($to, $subject, $templateSlug, 'failed', 'Email sending is switched off in Settings.', $userId);
            return ['ok' => false, 'error' => 'Email sending is switched off in Settings.'];
        }

        if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'That is not a valid email address.'];
        }

        $host = Settings::text('smtp_host');
        if ($host === '') {
            $message = 'SMTP is not configured yet — add it in Admin → Emails.';
            self::log($to, $subject, $templateSlug, 'failed', $message, $userId);
            return ['ok' => false, 'error' => $message];
        }

        $port = (int) Settings::number('smtp_port', 465);
        $smtp = new Smtp($host, $port, $port === 465 ? true : Settings::bool('smtp_secure', false));

        $result = $smtp->send(
            Settings::text('smtp_user'),
            Settings::text('smtp_password'),
            Settings::text('smtp_from_email', Settings::text('support_email', 'no-reply@' . self::domain())),
            Settings::text('smtp_from_name', Settings::text('site_name', 'FairCouples')),
            $to,
            $subject,
            self::wrap($html),
            $text,
            Settings::text('smtp_reply_to')
        );

        self::log($to, $subject, $templateSlug, $result['ok'] ? 'sent' : 'failed', $result['error'], $userId);

        return $result;
    }

    /** Sends a stored template with its variables filled in. */
    public static function template(string $slug, string $to, array $variables = [], ?string $userId = null): array
    {
        $template = Db::one('SELECT * FROM email_templates WHERE slug = ? AND is_active = 1 LIMIT 1', [$slug]);
        if (!$template) {
            return ['ok' => false, 'error' => "Email template '{$slug}' is missing or switched off."];
        }

        $variables += [
            'site_name' => Settings::text('site_name', 'FairCouples'),
            'site_url'  => Config::siteUrl(),
            'year'      => date('Y'),
        ];

        return self::send(
            $to,
            self::fill((string) $template['subject'], $variables),
            self::fill((string) $template['html_body'], $variables),
            self::fill((string) ($template['text_body'] ?? ''), $variables),
            $userId,
            $slug
        );
    }

    /** Replaces `{{name}}` placeholders, escaping every value. */
    private static function fill(string $body, array $variables): string
    {
        foreach ($variables as $key => $value) {
            if (is_array($value) || is_object($value)) {
                continue;
            }
            $body = str_replace('{{' . $key . '}}', Str::e((string) $value), $body);
        }
        // Anything still unresolved is dropped rather than shown to the reader.
        return preg_replace('/\{\{\s*[\w.]+\s*\}\}/', '', $body) ?? $body;
    }

    /** Wraps a template body in the branded shell. */
    private static function wrap(string $html): string
    {
        $siteName = Str::e(Settings::text('site_name', 'FairCouples'));
        $siteUrl = Str::e(Config::siteUrl());
        $address = Str::e(Settings::text('company_address', ''));
        $year = date('Y');

        return <<<HTML
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f6f7f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:14px;padding:32px">
{$html}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0 16px">
<p style="color:#64748b;font-size:12px;line-height:1.6;margin:0">
  <a href="{$siteUrl}" style="color:#e11d48;text-decoration:none">{$siteName}</a> &middot; &copy; {$year}<br>
  {$address}
</p>
</div>
</body></html>
HTML;
    }

    private static function log(
        string $to,
        string $subject,
        ?string $slug,
        string $status,
        ?string $error,
        ?string $userId
    ): void {
        Db::insert('email_logs', [
            'to_email'      => $to,
            'from_email'    => Settings::text('smtp_from_email'),
            'subject'       => mb_substr($subject, 0, 250),
            'template_slug' => $slug,
            'status'        => $status,
            'error'         => $error ? mb_substr($error, 0, 900) : null,
            'provider'      => 'smtp',
            'user_id'       => $userId,
            'sent_at'       => $status === 'sent' ? Str::now() : null,
        ]);
    }

    private static function domain(): string
    {
        return (string) (parse_url(Config::siteUrl(), PHP_URL_HOST) ?: 'localhost');
    }

    /** Used by the "Verify connection" button in Admin -> Emails. */
    public static function verify(): array
    {
        $host = Settings::text('smtp_host');
        if ($host === '') {
            return ['ok' => false, 'error' => 'Enter and save your SMTP host first.'];
        }

        $port = (int) Settings::number('smtp_port', 465);
        $smtp = new Smtp($host, $port, $port === 465 ? true : Settings::bool('smtp_secure', false));

        return $smtp->verify(Settings::text('smtp_user'), Settings::text('smtp_password'));
    }

    /** Notifies the support inbox, when admin notifications are switched on. */
    public static function notifyAdmin(string $subject, string $html): void
    {
        if (!Settings::bool('email_admin_notifications', true)) {
            return;
        }
        $inbox = Settings::text('support_email');
        if ($inbox !== '') {
            self::send($inbox, $subject, $html);
        }
    }
}
