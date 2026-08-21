<?php
declare(strict_types=1);

$me = Auth::requireAdmin();

/*
 * Everything the original brief asked to be controllable without touching a
 * file: branding, currency, signup rules, analytics and ad tags, the cookie
 * banner, tax, feature flags, maintenance mode — and the admin's own password.
 *
 * Each tab posts only its own keys, so saving one section never blanks another.
 */

if (Request::isPost()) {
    $section = Request::input('section');

    if ($section === 'password') {
        $result = Auth::changePassword(
            Request::input('current_password'),
            Request::input('new_password')
        );

        if ($result['ok']) {
            Audit::record('admin.password.change', 'user', $me['id'], 'Changed the admin password');
            Flash::success('Password changed. Your other sessions were signed out.');
        } else {
            Flash::error($result['error']);
        }

        Response::redirect('/admin/settings?tab=security');
    }

    $values = [];

    switch ($section) {
        case 'brand':
            $values = [
                'site_name'        => Request::input('site_name', 'FairCouples'),
                'site_tagline'     => Request::input('site_tagline'),
                'site_description' => Request::input('site_description'),
                'company_name'     => Request::input('company_name'),
                'company_address'  => Request::input('company_address'),
                'support_email'    => Request::input('support_email'),
                'contact_phone'    => Request::input('contact_phone'),
                'social_twitter'   => Request::input('social_twitter'),
                'social_instagram' => Request::input('social_instagram'),
                'social_facebook'  => Request::input('social_facebook'),
                'social_pinterest' => Request::input('social_pinterest'),
                'social_linkedin'  => Request::input('social_linkedin'),
                'social_tiktok'    => Request::input('social_tiktok'),
                'social_youtube'   => Request::input('social_youtube'),
            ];
            break;

        case 'money':
            $currencies = array_values(array_filter(array_map(
                static fn ($code) => Currency::normalise(trim($code)),
                explode(',', Request::input('supported_currencies', 'USD'))
            )));

            $values = [
                'default_currency'      => Currency::normalise(Request::input('default_currency', 'USD')),
                'supported_currencies'  => $currencies !== [] ? array_values(array_unique($currencies)) : ['USD'],
                'billing_currency_lock' => Request::bool('billing_currency_lock'),
                'billing_tax_enabled'   => Request::bool('billing_tax_enabled'),
                'billing_tax_rate'      => Str::clamp(Request::float('billing_tax_rate'), 0, 100),
                'billing_invoice_prefix' => Request::input('billing_invoice_prefix', 'FC'),
                'trial_days'            => max(0, Request::int('trial_days', 14)),
            ];
            break;

        case 'accounts':
            $values = [
                'signup_enabled'             => Request::bool('signup_enabled'),
                'require_email_verification' => Request::bool('require_email_verification'),
                'default_locale'             => Request::input('default_locale', 'en'),
            ];
            break;

        case 'social':
            $values = [
                'google_auth_enabled' => Request::bool('google_auth_enabled'),
                'google_client_id'    => trim(Request::input('google_client_id')),
            ];

            // The secret is write-only: a blank field keeps the stored value.
            $secret = trim(Request::input('google_client_secret'));
            if ($secret !== '') {
                $values['google_client_secret'] = $secret;
            }
            break;

        case 'analytics':
            $values = [
                'analytics_ga4_id'              => trim(Request::input('analytics_ga4_id')),
                'analytics_gtm_id'              => trim(Request::input('analytics_gtm_id')),
                'analytics_meta_pixel_id'       => trim(Request::input('analytics_meta_pixel_id')),
                'analytics_google_ads_id'       => trim(Request::input('analytics_google_ads_id')),
                'analytics_google_ads_label'    => trim(Request::input('analytics_google_ads_label')),
                'analytics_adsense_client'      => trim(Request::input('analytics_adsense_client')),
                'analytics_adsense_enabled'     => Request::bool('analytics_adsense_enabled'),
                'analytics_adsense_auto_ads'    => Request::bool('analytics_adsense_auto_ads'),
                'analytics_clarity_id'          => trim(Request::input('analytics_clarity_id')),
                'analytics_hotjar_id'           => trim(Request::input('analytics_hotjar_id')),
                'analytics_tiktok_pixel_id'     => trim(Request::input('analytics_tiktok_pixel_id')),
                'analytics_pinterest_tag_id'    => trim(Request::input('analytics_pinterest_tag_id')),
                'analytics_linkedin_partner_id' => trim(Request::input('analytics_linkedin_partner_id')),
                'cookie_banner_enabled'         => Request::bool('cookie_banner_enabled'),
            ];
            break;

        case 'features':
            $values = [
                'feature_blog_enabled'     => Request::bool('feature_blog_enabled'),
                'feature_ads_on_free'      => Request::bool('feature_ads_on_free'),
                'feature_referrals_enabled' => Request::bool('feature_referrals_enabled'),
                'maintenance_mode'         => Request::bool('maintenance_mode'),
                'maintenance_message'      => Request::input('maintenance_message'),
            ];

            foreach (Db::all('SELECT flag_key FROM feature_flags') as $flag) {
                Db::run(
                    'UPDATE feature_flags SET is_enabled = ?, rollout_pct = ? WHERE flag_key = ?',
                    [
                        Request::bool('flag_' . $flag['flag_key']) ? 1 : 0,
                        (int) Str::clamp((float) Request::int('rollout_' . $flag['flag_key'], 100), 0, 100),
                        $flag['flag_key'],
                    ]
                );
            }
            break;

        default:
            Flash::error('Unknown settings section.');
            Response::redirect('/admin/settings');
    }

    Settings::put($values, $me['id']);

    Audit::record('admin.settings.save', 'settings', $section, 'Saved the ' . $section . ' settings');
    Flash::success('Settings saved.');
    Response::redirect('/admin/settings?tab=' . urlencode($section));
}

$tab = (string) ($_GET['tab'] ?? 'brand');
$tabs = [
    'brand'     => 'Brand &amp; contact',
    'money'     => 'Currency &amp; billing',
    'accounts'  => 'Accounts',
    'social'    => 'Social login',
    'analytics' => 'Analytics &amp; ads',
    'features'  => 'Features &amp; maintenance',
    'security'  => 'Security',
];

if (!array_key_exists($tab, $tabs)) {
    $tab = 'brand';
}

$flags = Db::all('SELECT * FROM feature_flags ORDER BY name ASC');
$sessions = Db::all(
    'SELECT id, ip_address, user_agent, created_at, expires_at FROM sessions
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
    [$me['id']]
);

View::begin('layouts/admin', ['title' => 'Settings', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Settings</h1>
  <p>Everything here is stored in the database, so nothing on this page needs a file edit or a redeploy.</p>
</div>

<div class="tabs">
  <?php foreach ($tabs as $key => $label): ?>
    <a href="/admin/settings?tab=<?= $key ?>" class="<?= $tab === $key ? 'is-active' : '' ?>"><?= $label ?></a>
  <?php endforeach; ?>
</div>

<?php /* ------------------------------------------------------------- Brand */ ?>
<?php if ($tab === 'brand'): ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="section" value="brand">
    <div class="card-head"><h2>Brand &amp; contact</h2></div>
    <div class="card-body">
      <div class="field-row">
        <div class="field">
          <label for="site_name">Site name</label>
          <input class="input" id="site_name" name="site_name"
                 value="<?= Str::e(Settings::text('site_name', 'FairCouples')) ?>">
        </div>
        <div class="field">
          <label for="site_tagline">Tagline</label>
          <input class="input" id="site_tagline" name="site_tagline"
                 value="<?= Str::e(Settings::text('site_tagline')) ?>">
        </div>
      </div>

      <div class="field">
        <label for="site_description">Description</label>
        <textarea class="textarea" rows="3" id="site_description"
                  name="site_description"><?= Str::e(Settings::text('site_description')) ?></textarea>
        <span class="hint">The default meta description for any page that does not set its own.</span>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="company_name">Legal company name</label>
          <input class="input" id="company_name" name="company_name"
                 value="<?= Str::e(Settings::text('company_name')) ?>">
        </div>
        <div class="field">
          <label for="support_email">Support email</label>
          <input class="input" type="email" id="support_email" name="support_email"
                 value="<?= Str::e(Settings::text('support_email')) ?>">
        </div>
        <div class="field">
          <label for="contact_phone">Contact phone</label>
          <input class="input" id="contact_phone" name="contact_phone"
                 value="<?= Str::e(Settings::text('contact_phone')) ?>">
        </div>
      </div>

      <div class="field">
        <label for="company_address">Registered address</label>
        <textarea class="textarea" rows="2" id="company_address"
                  name="company_address"><?= Str::e(Settings::text('company_address')) ?></textarea>
        <span class="hint">Shown in the footer and on invoices, and required by most payment processors.</span>
      </div>

      <hr class="divider">
      <h3 style="font-family:var(--font);font-size:1rem">Social profiles</h3>
      <p class="small muted">Full URLs. These feed the footer links and the Organization schema.</p>

      <div class="field-row mt-2">
        <?php foreach ([
            'social_twitter'   => 'X / Twitter',
            'social_instagram' => 'Instagram',
            'social_facebook'  => 'Facebook',
        ] as $key => $label): ?>
          <div class="field">
            <label for="<?= $key ?>"><?= Str::e($label) ?></label>
            <input class="input" id="<?= $key ?>" name="<?= $key ?>" value="<?= Str::e(Settings::text($key)) ?>">
          </div>
        <?php endforeach; ?>
      </div>

      <div class="field-row">
        <?php foreach ([
            'social_pinterest' => 'Pinterest',
            'social_linkedin'  => 'LinkedIn',
            'social_tiktok'    => 'TikTok',
            'social_youtube'   => 'YouTube',
        ] as $key => $label): ?>
          <div class="field">
            <label for="<?= $key ?>"><?= Str::e($label) ?></label>
            <input class="input" id="<?= $key ?>" name="<?= $key ?>" value="<?= Str::e(Settings::text($key)) ?>">
          </div>
        <?php endforeach; ?>
      </div>

      <button class="btn btn-lg mt-3" type="submit">Save brand settings</button>
    </div>
  </form>
<?php endif; ?>

<?php /* ------------------------------------------------------------- Money */ ?>
<?php if ($tab === 'money'): ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="section" value="money">
    <div class="card-head"><h2>Currency &amp; billing</h2></div>
    <div class="card-body">
      <p class="small muted">
        A visitor's currency is picked from their account country first, then their browser locale,
        then this default. They can still choose it themselves on the signup page.
      </p>

      <div class="field-row mt-3">
        <div class="field">
          <label for="default_currency">Fallback currency</label>
          <select class="select" id="default_currency" name="default_currency">
            <?php foreach (['USD', 'GBP', 'EUR', 'CAD', 'AUD'] as $code): ?>
              <option value="<?= $code ?>"
                      <?= Settings::text('default_currency', 'USD') === $code ? 'selected' : '' ?>>
                <?= $code ?> <?= Str::e(Currency::symbol($code)) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>
        <div class="field">
          <label for="supported_currencies">Currencies you sell in</label>
          <input class="input" id="supported_currencies" name="supported_currencies"
                 value="<?= Str::e(implode(', ', Settings::list('supported_currencies', ['USD']))) ?>">
          <span class="hint">Comma separated. Every plan needs a price row in each one.</span>
        </div>
        <div class="field">
          <label for="trial_days">Free trial length (days)</label>
          <input class="input" type="number" min="0" max="90" id="trial_days" name="trial_days"
                 value="<?= (int) Settings::number('trial_days', 14) ?>">
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="billing_tax_rate">Tax rate (%)</label>
          <input class="input" type="number" min="0" max="100" step="0.01" id="billing_tax_rate"
                 name="billing_tax_rate" value="<?= Str::e(Settings::number('billing_tax_rate', 0)) ?>">
        </div>
        <div class="field">
          <label for="billing_invoice_prefix">Invoice number prefix</label>
          <input class="input mono" id="billing_invoice_prefix" name="billing_invoice_prefix"
                 value="<?= Str::e(Settings::text('billing_invoice_prefix', 'FC')) ?>">
        </div>
      </div>

      <div class="stack-sm mt-2">
        <label class="checkbox">
          <input type="checkbox" name="billing_tax_enabled" value="1"
                 <?= Settings::bool('billing_tax_enabled') ? 'checked' : '' ?>>
          <span>Add tax at checkout — leave off if Stripe Tax handles it for you</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" name="billing_currency_lock" value="1"
                 <?= Settings::bool('billing_currency_lock') ? 'checked' : '' ?>>
          <span>Lock a customer's currency after their first payment</span>
        </label>
      </div>

      <button class="btn btn-lg mt-3" type="submit">Save billing settings</button>
    </div>
  </form>
<?php endif; ?>

<?php /* ---------------------------------------------------------- Accounts */ ?>
<?php if ($tab === 'accounts'): ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="section" value="accounts">
    <div class="card-head"><h2>Accounts</h2></div>
    <div class="card-body">
      <div class="field" style="max-width:16rem">
        <label for="default_locale">Default language</label>
        <select class="select" id="default_locale" name="default_locale">
          <?= View::options([
              'en'    => 'English',
              'en-GB' => 'English (UK)',
              'en-US' => 'English (US)',
          ], Settings::text('default_locale', 'en')) ?>
        </select>
      </div>

      <div class="stack-sm mt-3">
        <label class="checkbox">
          <input type="checkbox" name="signup_enabled" value="1"
                 <?= Settings::bool('signup_enabled', true) ? 'checked' : '' ?>>
          <span>
            Allow new signups
            <span class="hint">Turning this off leaves existing members signed in but closes registration.</span>
          </span>
        </label>
        <label class="checkbox">
          <input type="checkbox" name="require_email_verification" value="1"
                 <?= Settings::bool('require_email_verification', true) ? 'checked' : '' ?>>
          <span>
            Require email confirmation before the dashboard opens
            <span class="hint">Needs working SMTP — check Admin → Email first.</span>
          </span>
        </label>
      </div>

      <button class="btn btn-lg mt-3" type="submit">Save account settings</button>
    </div>
  </form>
<?php endif; ?>

<?php /* ------------------------------------------------------ Social login */ ?>
<?php if ($tab === 'social'): ?>
  <?php $secretSet = Settings::text('google_client_secret') !== ''; ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="section" value="social">
    <div class="card-head"><h2>Sign in with Google</h2></div>
    <div class="card-body">
      <p class="small muted">
        Adds a “Continue with Google” button to the sign-up and sign-in pages so people can
        register in one tap. New Google accounts are created verified, with no password.
      </p>

      <div class="alert alert-info mt-3">
        <div>
          <p class="bold small">Set it up in three steps</p>
          <ol class="small" style="margin:0.4rem 0 0 1.1rem;padding:0">
            <li>Open <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">Google Cloud → Credentials</a> and create an <strong>OAuth client ID</strong> of type <strong>Web application</strong>.</li>
            <li>Under <strong>Authorized redirect URIs</strong>, add the exact URL below.</li>
            <li>Paste the Client ID and Client secret here, tick “Enable”, and save.</li>
          </ol>
        </div>
      </div>

      <div class="field mt-3">
        <label>Authorized redirect URI <span class="hint">— paste this into Google exactly</span></label>
        <div class="row" style="gap:0.5rem;align-items:center">
          <input class="input mono" readonly value="<?= Str::e(GoogleAuth::redirectUri()) ?>"
                 onclick="this.select()" style="flex:1">
          <button type="button" class="btn btn-sm btn-outline"
                  data-copy="<?= Str::e(GoogleAuth::redirectUri()) ?>">Copy</button>
        </div>
        <span class="hint">Also add your homepage under “Authorized JavaScript origins”.</span>
      </div>

      <hr class="divider">

      <div class="field">
        <label for="google_client_id">Client ID</label>
        <input class="input mono" id="google_client_id" name="google_client_id"
               placeholder="000000000000-xxxxxxxx.apps.googleusercontent.com"
               value="<?= Str::e(Settings::text('google_client_id')) ?>">
      </div>

      <div class="field">
        <label for="google_client_secret">
          Client secret
          <?php if ($secretSet): ?><span class="badge badge-success">saved</span><?php endif; ?>
        </label>
        <input class="input mono" type="password" id="google_client_secret" name="google_client_secret"
               autocomplete="new-password"
               placeholder="<?= $secretSet ? 'Leave blank to keep the saved secret' : 'Paste the client secret' ?>">
        <span class="hint">Stored write-only — the panel can tell you it is set, never show it back.</span>
      </div>

      <label class="checkbox mt-3">
        <input type="checkbox" name="google_auth_enabled" value="1"
               <?= Settings::bool('google_auth_enabled') ? 'checked' : '' ?>>
        <span>
          Enable “Continue with Google”
          <span class="hint">The button only appears once this is on and both the Client ID and secret are saved.</span>
        </span>
      </label>

      <p class="small mt-3">
        Status:
        <?php if (GoogleAuth::enabled()): ?>
          <span class="badge badge-success">Live</span> visitors can sign in with Google now.
        <?php elseif (GoogleAuth::configured()): ?>
          <span class="badge badge-warning">Ready</span> credentials saved — tick “Enable” to switch it on.
        <?php else: ?>
          <span class="badge">Off</span> add the Client ID and secret to get started.
        <?php endif; ?>
      </p>

      <button class="btn btn-lg mt-3" type="submit">Save Google settings</button>
    </div>
  </form>
<?php endif; ?>

<?php /* --------------------------------------------------------- Analytics */ ?>
<?php if ($tab === 'analytics'): ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="section" value="analytics">
    <div class="card-head"><h2>Analytics, pixels &amp; ads</h2></div>
    <div class="card-body">
      <p class="small muted">
        Paste an ID and the matching script is injected site-wide. Leave a field blank and nothing
        is loaded — no tag manager, no wasted request.
      </p>

      <hr class="divider">
      <h3 style="font-family:var(--font);font-size:1rem">Google</h3>

      <div class="field-row mt-2">
        <div class="field">
          <label for="analytics_ga4_id">Google Analytics 4 measurement ID</label>
          <input class="input mono" id="analytics_ga4_id" name="analytics_ga4_id" placeholder="G-XXXXXXXXXX"
                 value="<?= Str::e(Settings::text('analytics_ga4_id')) ?>">
        </div>
        <div class="field">
          <label for="analytics_gtm_id">Google Tag Manager container</label>
          <input class="input mono" id="analytics_gtm_id" name="analytics_gtm_id" placeholder="GTM-XXXXXXX"
                 value="<?= Str::e(Settings::text('analytics_gtm_id')) ?>">
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="analytics_google_ads_id">Google Ads conversion ID</label>
          <input class="input mono" id="analytics_google_ads_id" name="analytics_google_ads_id"
                 placeholder="AW-XXXXXXXXX"
                 value="<?= Str::e(Settings::text('analytics_google_ads_id')) ?>">
        </div>
        <div class="field">
          <label for="analytics_google_ads_label">Google Ads conversion label</label>
          <input class="input mono" id="analytics_google_ads_label" name="analytics_google_ads_label"
                 value="<?= Str::e(Settings::text('analytics_google_ads_label')) ?>">
          <span class="hint">Fired on a completed subscription.</span>
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="analytics_adsense_client">AdSense publisher ID</label>
          <input class="input mono" id="analytics_adsense_client" name="analytics_adsense_client"
                 placeholder="ca-pub-0000000000000000"
                 value="<?= Str::e(Settings::text('analytics_adsense_client')) ?>">
        </div>
      </div>

      <div class="stack-sm">
        <label class="checkbox">
          <input type="checkbox" name="analytics_adsense_enabled" value="1"
                 <?= Settings::bool('analytics_adsense_enabled') ? 'checked' : '' ?>>
          <span>Load AdSense</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" name="analytics_adsense_auto_ads" value="1"
                 <?= Settings::bool('analytics_adsense_auto_ads') ? 'checked' : '' ?>>
          <span>Let Google place Auto ads</span>
        </label>
      </div>

      <hr class="divider">
      <h3 style="font-family:var(--font);font-size:1rem">Meta &amp; social pixels</h3>

      <div class="field-row mt-2">
        <div class="field">
          <label for="analytics_meta_pixel_id">Meta (Facebook) Pixel ID</label>
          <input class="input mono" id="analytics_meta_pixel_id" name="analytics_meta_pixel_id"
                 value="<?= Str::e(Settings::text('analytics_meta_pixel_id')) ?>">
        </div>
        <div class="field">
          <label for="analytics_tiktok_pixel_id">TikTok Pixel ID</label>
          <input class="input mono" id="analytics_tiktok_pixel_id" name="analytics_tiktok_pixel_id"
                 value="<?= Str::e(Settings::text('analytics_tiktok_pixel_id')) ?>">
        </div>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="analytics_pinterest_tag_id">Pinterest Tag ID</label>
          <input class="input mono" id="analytics_pinterest_tag_id" name="analytics_pinterest_tag_id"
                 value="<?= Str::e(Settings::text('analytics_pinterest_tag_id')) ?>">
        </div>
        <div class="field">
          <label for="analytics_linkedin_partner_id">LinkedIn Partner ID</label>
          <input class="input mono" id="analytics_linkedin_partner_id" name="analytics_linkedin_partner_id"
                 value="<?= Str::e(Settings::text('analytics_linkedin_partner_id')) ?>">
        </div>
      </div>

      <hr class="divider">
      <h3 style="font-family:var(--font);font-size:1rem">Behaviour analytics</h3>

      <div class="field-row mt-2">
        <div class="field">
          <label for="analytics_clarity_id">Microsoft Clarity project ID</label>
          <input class="input mono" id="analytics_clarity_id" name="analytics_clarity_id"
                 value="<?= Str::e(Settings::text('analytics_clarity_id')) ?>">
        </div>
        <div class="field">
          <label for="analytics_hotjar_id">Hotjar site ID</label>
          <input class="input mono" id="analytics_hotjar_id" name="analytics_hotjar_id"
                 value="<?= Str::e(Settings::text('analytics_hotjar_id')) ?>">
        </div>
      </div>

      <hr class="divider">
      <label class="checkbox">
        <input type="checkbox" name="cookie_banner_enabled" value="1"
               <?= Settings::bool('cookie_banner_enabled', true) ? 'checked' : '' ?>>
        <span>
          Show the cookie consent banner
          <span class="hint">
            Required in the UK and the EU whenever any of the tags above are set. Tracking scripts wait
            for consent; nothing loads before the visitor accepts.
          </span>
        </span>
      </label>

      <button class="btn btn-lg mt-3" type="submit">Save analytics settings</button>
    </div>
  </form>
<?php endif; ?>

<?php /* ---------------------------------------------------------- Features */ ?>
<?php if ($tab === 'features'): ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="section" value="features">
    <div class="card-head"><h2>Features &amp; maintenance</h2></div>
    <div class="card-body">
      <div class="stack-sm">
        <label class="checkbox">
          <input type="checkbox" name="feature_blog_enabled" value="1"
                 <?= Settings::bool('feature_blog_enabled', true) ? 'checked' : '' ?>>
          <span>Show the blog</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" name="feature_ads_on_free" value="1"
                 <?= Settings::bool('feature_ads_on_free') ? 'checked' : '' ?>>
          <span>Show ads to free members only</span>
        </label>
        <label class="checkbox">
          <input type="checkbox" name="feature_referrals_enabled" value="1"
                 <?= Settings::bool('feature_referrals_enabled') ? 'checked' : '' ?>>
          <span>Enable the referral programme</span>
        </label>
      </div>

      <?php if ($flags !== []): ?>
        <hr class="divider">
        <h3 style="font-family:var(--font);font-size:1rem">Feature flags</h3>
        <div class="table-wrap mt-2">
          <table>
            <thead><tr><th>Flag</th><th>On</th><th>Rollout %</th></tr></thead>
            <tbody>
              <?php foreach ($flags as $flag): ?>
                <tr>
                  <td>
                    <span class="bold small"><?= Str::e($flag['name']) ?></span>
                    <span class="tiny muted mono" style="display:block"><?= Str::e($flag['flag_key']) ?></span>
                    <span class="tiny muted"><?= Str::e($flag['description'] ?? '') ?></span>
                  </td>
                  <td>
                    <input type="checkbox" name="flag_<?= Str::e($flag['flag_key']) ?>" value="1"
                           <?= Str::bool($flag['is_enabled']) ? 'checked' : '' ?>>
                  </td>
                  <td>
                    <input class="input" type="number" min="0" max="100" style="width:6rem"
                           name="rollout_<?= Str::e($flag['flag_key']) ?>"
                           value="<?= (int) $flag['rollout_pct'] ?>">
                  </td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      <?php endif; ?>

      <hr class="divider">
      <h3 style="font-family:var(--font);font-size:1rem">Maintenance mode</h3>

      <label class="checkbox mt-2">
        <input type="checkbox" name="maintenance_mode" value="1"
               <?= Settings::bool('maintenance_mode') ? 'checked' : '' ?>>
        <span>
          Put the public site into maintenance
          <span class="hint">
            Visitors see a holding page and robots.txt goes to full Disallow. Admins keep full access,
            so you can still work while it is on.
          </span>
        </span>
      </label>

      <div class="field mt-2">
        <label for="maintenance_message">Message shown to visitors</label>
        <textarea class="textarea" rows="2" id="maintenance_message"
                  name="maintenance_message"><?= Str::e(Settings::text('maintenance_message')) ?></textarea>
      </div>

      <button class="btn btn-lg mt-3" type="submit">Save feature settings</button>
    </div>
  </form>
<?php endif; ?>

<?php /* ---------------------------------------------------------- Security */ ?>
<?php if ($tab === 'security'): ?>
  <form method="post" class="card">
    <?= Csrf::field() ?>
    <input type="hidden" name="section" value="password">
    <div class="card-head"><h2>Change your admin password</h2></div>
    <div class="card-body">
      <p class="small muted">
        Changing it signs out every other session on your account, including any device you left signed in.
      </p>

      <div class="field mt-3" style="max-width:24rem">
        <label for="current_password">Current password</label>
        <input class="input" type="password" id="current_password" name="current_password"
               required autocomplete="current-password">
      </div>

      <div class="field" style="max-width:24rem">
        <label for="new_password">New password</label>
        <input class="input" type="password" id="new_password" name="new_password"
               required minlength="10" autocomplete="new-password">
        <span class="hint">At least 10 characters, with an upper case letter, a lower case letter and a digit.</span>
      </div>

      <button class="btn mt-2" type="submit">Change password</button>
    </div>
  </form>

  <div class="card mt-3">
    <div class="card-head"><h2>Your recent sessions</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Signed in</th><th>IP</th><th>Device</th><th>Expires</th></tr></thead>
        <tbody>
          <?php foreach ($sessions as $session): ?>
            <tr>
              <td class="small muted nowrap"><?= Str::e(Str::dateTime($session['created_at'])) ?></td>
              <td class="small mono"><?= Str::e($session['ip_address'] ?? '—') ?></td>
              <td class="tiny muted"><?= Str::e(Str::excerpt($session['user_agent'], 60)) ?></td>
              <td class="small muted nowrap"><?= Str::e(Str::dateTime($session['expires_at'])) ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>

  <div class="card mt-3">
    <div class="card-head"><h2>Where the secrets live</h2></div>
    <div class="card-body">
      <p class="small">
        Your MySQL credentials and the app key are in <code>app/config.php</code> — the one file on the
        server that is not editable from this panel, on purpose. Payment keys and the SMTP password are
        stored write-only in the database: the panel can tell you whether one is set, never what it is.
      </p>
      <p class="small muted mt-2">
        Site URL: <code><?= Str::e(Config::siteUrl()) ?></code><br>
        Environment: <code><?= Str::e(Config::isDev() ? 'development' : 'production') ?></code><br>
        PHP: <code><?= Str::e(PHP_VERSION) ?></code>
      </p>
    </div>
  </div>
<?php endif; ?>

<?php View::end(); ?>
