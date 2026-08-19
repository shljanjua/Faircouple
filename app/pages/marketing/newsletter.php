<?php
declare(strict_types=1);

$email = strtolower(Request::input('email'));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    Flash::error('Enter a valid email address.');
    Response::back('/');
}

Db::run(
    'INSERT INTO newsletter_subscribers (id, email, name, source, country_code, status)
     VALUES (?, ?, ?, ?, ?, "subscribed")
     ON DUPLICATE KEY UPDATE
       source          = VALUES(source),
       status          = "subscribed",
       unsubscribed_at = NULL',
    [
        Str::uuid(),
        $email,
        Request::nullable('name'),
        Request::input('source', 'footer'),
        substr((string) (Request::header('CF-IPCountry') ?? ''), 0, 2) ?: null,
    ]
);

Flash::success('You are on the list. Look out for the weekly fairness tips.');
Response::back('/');
