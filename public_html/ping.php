<?php
// ---------------------------------------------------------------------------
// Placement & PHP test. Visit /ping.php directly.
//
// If you see "FairCouples PHP OK" then your files are in the right place and
// PHP runs — any 403 on other pages is about routing or the .htaccess, not
// placement. If /ping.php ITSELF gives 403, the problem is where the files
// live (they must sit DIRECTLY in public_html, not in a sub-folder) or the
// folder/file permissions (folders 755, files 644).
//
// Delete this file once the site is working.
// ---------------------------------------------------------------------------
header('Content-Type: text/plain; charset=utf-8');

echo "FairCouples PHP OK\n";
echo 'PHP version: ' . PHP_VERSION . "\n";
echo 'This file is at: ' . __DIR__ . "\n";
echo 'index.php present here: ' . (is_file(__DIR__ . '/index.php') ? 'yes' : 'NO — wrong folder!') . "\n";
echo 'app/config.php present: ' . (is_file(__DIR__ . '/app/config.php') ? 'yes' : 'NO') . "\n";
echo '.htaccess present: ' . (is_file(__DIR__ . '/.htaccess') ? 'yes' : 'NO — enable "show hidden files" and re-upload it') . "\n";
echo 'pdo_mysql loaded: ' . (extension_loaded('pdo_mysql') ? 'yes' : 'NO') . "\n";
