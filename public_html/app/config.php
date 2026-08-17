<?php
/**
 * FairCouples — the only file you have to edit before going live.
 *
 * Everything else (payment keys, SMTP, analytics, legal text, plans, prices)
 * is edited from the admin panel at /admin once you are signed in.
 */

return [

    // ---------------------------------------------------------------- Database
    // hPanel -> Databases -> MySQL Databases shows all four values.
    'db' => [
        'host'     => 'localhost',
        'port'     => 3306,
        'name'     => 'u237845628_Faircouple',
        'user'     => 'u237845628_Faircouple',
        'password' => 'PUT-YOUR-MYSQL-PASSWORD-HERE',
        'charset'  => 'utf8mb4',
    ],

    // ------------------------------------------------------------------- Site
    // No trailing slash. Change this when you move to your real domain.
    'site_url' => 'https://grey-opossum-178268.hostingersite.com',

    // ---------------------------------------------------------------- Security
    // Signs cookies and one-time links. Replace with 60+ random characters.
    // You can generate one at https://www.random.org/strings/ or just mash keys.
    'app_key' => 'CHANGE-THIS-TO-A-LONG-RANDOM-STRING-AT-LEAST-60-CHARACTERS-LONG',

    // Protects /cron.php. Put the same value in the hPanel cron command.
    'cron_secret' => 'CHANGE-THIS-TOO',

    // ------------------------------------------------------------------ Files
    // Where uploads are written. Relative paths are resolved from public_html.
    // Move this above public_html once everything works, e.g.
    //   '/home/u237845628/faircouples-uploads'
    'upload_dir' => __DIR__ . '/../storage/uploads',

    // ------------------------------------------------------------------- Misc
    // 'production' hides PHP errors from visitors. Use 'development' only while
    // you are setting things up.
    'env'      => 'production',
    'timezone' => 'UTC',
];
