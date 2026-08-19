<?php
declare(strict_types=1);

/**
 * The route table. Each entry maps a URL to a file in app/pages/.
 * Pages both render themselves and handle their own form posts, so most
 * routes accept GET and POST.
 */

$router = new Router();

/* ------------------------------------------------------------------ Marketing */
$router->get('/',                       'marketing/home');
$router->get('/features',               'marketing/features');
$router->get('/fairness',               'marketing/fairness');
$router->get('/pricing',                'marketing/pricing');
$router->get('/checklists',             'marketing/checklists');
$router->get('/faq',                    'marketing/faq');
$router->any('/contact',                'marketing/contact');
$router->any('/love-or-attraction',     'marketing/love-or-attraction');
$router->get('/blog',                   'marketing/blog-index');
$router->get('/blog/{slug}',            'marketing/blog-post');
$router->get('/destinations',           'marketing/destinations-index');
$router->get('/destinations/{slug}',    'marketing/destination');
$router->get('/countries',              'marketing/countries-index');
$router->get('/countries/{slug}',       'marketing/country');
$router->post('/newsletter',            'marketing/newsletter');

/* ----------------------------------------------------------------- Technical */
$router->get('/sitemap.xml',            'system/sitemap');
$router->get('/sitemap-pages.xml',      'system/sitemap');
$router->get('/sitemap-blog.xml',       'system/sitemap');
$router->get('/sitemap-travel.xml',     'system/sitemap');
$router->get('/robots.txt',             'system/robots');
$router->get('/health',                 'system/health');

/* ------------------------------------------------------------------ Accounts */
$router->any('/signup',                 'auth/signup');
$router->any('/signin',                 'auth/signin');
$router->any('/signout',                'auth/signout');
$router->any('/forgot-password',        'auth/forgot-password');
$router->any('/reset-password',         'auth/reset-password');
$router->any('/verify-email',           'auth/verify-email');

/* -------------------------------------------------------------- Relationship */
$router->any('/onboarding',             'app/onboarding');
$router->any('/invite/{token}',         'app/invite');
$router->any('/join/{code}',            'app/join');

$router->any('/dashboard',              'app/dashboard');
$router->any('/dashboard/love',         'app/love');
$router->any('/dashboard/letters',      'app/letters');
$router->any('/dashboard/story',        'app/story');
$router->any('/dashboard/bucket',       'app/bucket');
$router->any('/dashboard/fairness',     'app/fairness');
$router->any('/dashboard/emotions',     'app/emotions');
$router->any('/dashboard/checkin',      'app/checkin');
$router->any('/dashboard/compatibility','app/compatibility');
$router->any('/dashboard/checklists',   'app/checklists');
$router->any('/dashboard/messages',     'app/messages');
$router->get('/dashboard/messages/poll','app/messages-poll');
$router->any('/dashboard/gallery',      'app/gallery');
$router->any('/dashboard/gifts',        'app/gifts');
$router->any('/dashboard/budget',       'app/budget');
$router->any('/dashboard/documents',    'app/documents');
$router->any('/dashboard/travel',       'app/travel');
$router->any('/dashboard/travel/{id}',  'app/trip');
$router->any('/dashboard/partner',      'app/partner');
$router->any('/dashboard/settings',     'app/settings');
$router->any('/dashboard/billing',      'app/billing');
$router->any('/dashboard/notifications','app/notifications');
$router->get('/dashboard/export',       'app/export');

/* ------------------------------------------------------------------ Checkout */
$router->any('/checkout',               'app/checkout');
$router->get('/checkout/paypal-return', 'app/paypal-return');

/* --------------------------------------------------------------- Admin panel */
$router->any('/admin',                  'admin/dashboard');
$router->any('/admin/users',            'admin/users');
$router->any('/admin/couples',          'admin/couples');
$router->any('/admin/plans',            'admin/plans');
$router->any('/admin/subscriptions',    'admin/subscriptions');
$router->any('/admin/payments',         'admin/payments');
$router->any('/admin/coupons',          'admin/coupons');
$router->any('/admin/blog',             'admin/blog');
$router->any('/admin/pages',            'admin/pages');
$router->any('/admin/content',          'admin/content');
$router->any('/admin/destinations',     'admin/destinations');
$router->any('/admin/seo',              'admin/seo');
$router->any('/admin/emails',           'admin/emails');
$router->any('/admin/contacts',         'admin/contacts');
$router->any('/admin/settings',         'admin/settings');
$router->any('/admin/audit',            'admin/audit');

/* ----------------------------------------------------------------- CMS pages */
// Kept last so a real route always wins over a database page slug.
$router->get('/{slug}',                 'marketing/page');

return $router;
