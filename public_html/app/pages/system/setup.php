<?php
declare(strict_types=1);

/**
 * First-run helper.
 *
 * Shown when app/config.php still holds its placeholder values, or when the
 * database cannot be reached. It checks the server and tells you exactly what
 * to fix, without ever printing your password back to the page.
 */

$db = (array) Config::get('db', []);

$checks = [
    [
        'label' => 'PHP 8.1 or newer',
        'ok'    => PHP_VERSION_ID >= 80100,
        'fix'   => 'In hPanel → Advanced → PHP Configuration, choose PHP 8.1, 8.2 or 8.3. You are on ' . PHP_VERSION . '.',
    ],
    [
        'label' => 'PDO MySQL extension',
        'ok'    => extension_loaded('pdo_mysql'),
        'fix'   => 'Enable pdo_mysql in hPanel → Advanced → PHP Configuration → PHP extensions.',
    ],
    [
        'label' => 'cURL extension (for Stripe and PayPal)',
        'ok'    => function_exists('curl_init'),
        'fix'   => 'Enable curl in hPanel → Advanced → PHP Configuration → PHP extensions.',
    ],
    [
        'label' => 'OpenSSL (for secure SMTP)',
        'ok'    => extension_loaded('openssl'),
        'fix'   => 'Enable openssl in hPanel → Advanced → PHP Configuration → PHP extensions.',
    ],
    [
        'label' => 'Database password filled in',
        'ok'    => ($db['password'] ?? '') !== 'PUT-YOUR-MYSQL-PASSWORD-HERE' && ($db['password'] ?? '') !== '',
        'fix'   => 'Open app/config.php in File Manager and put your MySQL password in the "password" line.',
    ],
    [
        'label' => 'Security key changed',
        'ok'    => !str_starts_with(Config::key(), 'CHANGE-THIS'),
        'fix'   => 'Open app/config.php and replace app_key with 60 or more random characters.',
    ],
    [
        'label' => 'Upload folder is writable',
        'ok'    => is_dir(Config::uploadDir()) ? is_writable(Config::uploadDir()) : @mkdir(Config::uploadDir(), 0755, true),
        'fix'   => 'In File Manager, set the permissions of storage/uploads to 755 (or 775).',
    ],
];

$dbReachable = Db::isReachable();
$checks[] = [
    'label' => 'Database connection',
    'ok'    => $dbReachable,
    'fix'   => 'Check the four database values in app/config.php against hPanel → Databases → MySQL Databases. '
        . ($dbReachable ? '' : 'MySQL said: ' . Str::e((string) Db::lastError())),
];

$tablesReady = false;
if ($dbReachable) {
    $tablesReady = Db::one('SHOW TABLES LIKE "profiles"') !== null;
    $checks[] = [
        'label' => 'Database tables imported',
        'ok'    => $tablesReady,
        'fix'   => 'Open hPanel → Databases → phpMyAdmin, pick your database, then Import → '
            . 'database/mysql/faircouples-mysql.sql → Go.',
    ];
}

$remaining = count(array_filter($checks, static fn ($check) => !$check['ok']));

http_response_code($remaining > 0 ? 503 : 200);
?>
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>FairCouples — setup</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/assets/css/app.css">
</head>
<body>
  <main class="container container-narrow section">
    <p class="eyebrow">Setup</p>
    <h1>Let&rsquo;s finish installing FairCouples</h1>
    <p class="muted mt-2">
      This page appears only until the checks below all pass. Nobody can see your site while it is showing.
    </p>

    <div class="card mt-4">
      <div class="card-head"><h2><?= $remaining === 0 ? 'Everything is ready' : $remaining . ' thing(s) left to do' ?></h2></div>
      <div class="card-body stack">
        <?php foreach ($checks as $check): ?>
          <div class="row" style="align-items:flex-start;gap:0.75rem">
            <span style="font-size:1.15rem;line-height:1.3"><?= $check['ok'] ? '✅' : '⚠️' ?></span>
            <div style="flex:1;min-width:0">
              <p class="bold"><?= Str::e($check['label']) ?></p>
              <?php if (!$check['ok']): ?>
                <p class="small muted mt-1"><?= $check['fix'] ?></p>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    </div>

    <?php if ($remaining === 0): ?>
      <div class="alert alert-success mt-3">
        <div>
          <strong>Ready to go.</strong>
          Reload this page and the site will appear. Then create your account at
          <a href="/signup">/signup</a> and run this in phpMyAdmin to make yourself the administrator:
          <br><code>UPDATE profiles SET role = 'superadmin' WHERE email = 'you@example.com';</code>
        </div>
      </div>
      <a class="btn btn-lg mt-3" href="/">Open the site</a>
    <?php else: ?>
      <div class="card mt-3">
        <div class="card-head"><h2>The whole install, start to finish</h2></div>
        <div class="card-body prose small">
          <ol>
            <li><strong>Create the database.</strong> hPanel → Databases → MySQL Databases. Note the database name, user and password.</li>
            <li><strong>Import the data.</strong> hPanel → Databases → phpMyAdmin → select your database → Import →
                choose <code>database/mysql/faircouples-mysql.sql</code> → Go.</li>
            <li><strong>Upload the site.</strong> Put everything from the <code>public_html</code> folder into your
                <code>public_html</code> on Hostinger.</li>
            <li><strong>Edit one file.</strong> Open <code>app/config.php</code> in File Manager and fill in the database
                password, the <code>app_key</code> and the <code>cron_secret</code>.</li>
            <li><strong>Reload this page.</strong> Every check above should turn green.</li>
          </ol>
        </div>
      </div>
    <?php endif; ?>

    <p class="small muted mt-4">
      Server: PHP <?= Str::e(PHP_VERSION) ?> ·
      Upload folder: <code><?= Str::e(Config::uploadDir()) ?></code>
    </p>
  </main>
</body>
</html>
