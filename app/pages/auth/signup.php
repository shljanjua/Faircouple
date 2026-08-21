<?php
declare(strict_types=1);

if (Auth::check()) {
    Response::redirect('/dashboard');
}

$planSlug   = Request::input('plan');
$interval   = Request::input('interval', 'year');
$inviteToken = Request::input('invite');
$sent       = false;

$defaultCountry  = strtoupper((string) (Request::header('CF-IPCountry') ?? 'US'));
$defaultCurrency = Currency::forCountry($defaultCountry);

// An emailed invitation pre-fills the address it was sent to.
$invitedEmail = '';
if ($inviteToken !== '') {
    $invitation = Db::one(
        'SELECT email FROM couple_invitations WHERE token = ? AND status = "pending" AND expires_at > UTC_TIMESTAMP() LIMIT 1',
        [$inviteToken]
    );
    $invitedEmail = $invitation['email'] ?? '';
}

if (Request::isPost()) {
    $result = Auth::signUp([
        'full_name'     => Request::input('full_name'),
        'email'         => Request::input('email'),
        'password'      => Request::raw('password'),
        'country'       => Request::input('country', 'US'),
        'currency'      => Request::input('currency', 'USD'),
        'timezone'      => Request::input('timezone', 'UTC'),
        'marketing'     => Request::bool('marketing'),
        'accept_terms'  => Request::bool('accept_terms'),
    ]);

    if (!$result['ok']) {
        Flash::error($result['error']);
        if (!empty($result['field'])) {
            Flash::fieldError($result['field'], $result['error']);
        }
        Flash::remember(Request::all());
        Response::redirect('/signup?' . http_build_query(array_filter([
            'plan' => $planSlug, 'interval' => $interval, 'invite' => $inviteToken,
        ])));
    }

    Flash::clearOld();
    Flash::clearErrors();

    if (!empty($result['verify'])) {
        $sent = true;
    } else {
        if ($inviteToken !== '') {
            Response::redirect('/invite/' . rawurlencode($inviteToken));
        }
        if ($planSlug !== '') {
            Response::redirect('/checkout?plan=' . rawurlencode($planSlug)
                . '&interval=' . rawurlencode($interval)
                . '&currency=' . rawurlencode(Request::input('currency', 'USD')));
        }
        Response::redirect('/onboarding');
    }
}

$relationshipTypes = [
    'romantic'      => 'Dating / partners',
    'engaged'       => 'Engaged',
    'married'       => 'Married',
    'long_distance' => 'Long-distance',
    'parent_child'  => 'Parent & child',
    'siblings'      => 'Siblings',
    'friends'       => 'Close friends',
    'family'        => 'Other family',
];

View::begin('layouts/auth', [
    'title'       => 'Create your account',
    'description' => 'Create a free FairCouples account. Both partners log their own side, and one subscription covers you both.',
    'no_index'    => true,
]);
?>

<?php if ($sent): ?>
  <div class="center">
    <p style="font-size:2.5rem">📬</p>
    <h1 style="font-size:1.5rem">Check your email</h1>
    <p class="small muted mt-2">
      We sent a confirmation link to <strong><?= Str::e(Request::input('email')) ?></strong>.
      Click it to activate your account — the link is valid for 24 hours.
    </p>
    <div class="alert alert-info mt-3">
      <div>
        Nothing arrived? Check your spam folder, then
        <a href="/verify-email?resend=<?= urlencode(Request::input('email')) ?>">send it again</a>.
      </div>
    </div>
    <p class="small mt-3"><a href="/signin">Back to sign in</a></p>
  </div>
<?php else: ?>

  <h1 style="font-size:1.5rem">Create your account</h1>
  <p class="small muted mt-1">
    Free forever plan, no card required.
    <?php if ($planSlug !== ''): ?>
      You picked the <strong><?= Str::e(ucfirst($planSlug)) ?></strong> plan — checkout comes next.
    <?php endif; ?>
  </p>

  <form method="post" class="mt-3">
    <?= Csrf::field() ?>
    <input type="hidden" name="timezone" value="">

    <div class="field">
      <label for="full_name">Full name <span class="required">*</span></label>
      <input class="input" id="full_name" name="full_name" required autocomplete="name" maxlength="120"
             value="<?= Str::e(Flash::old('full_name')) ?>"
             <?= Flash::errorFor('full_name') ? 'aria-invalid="true"' : '' ?>>
      <?php if ($error = Flash::errorFor('full_name')): ?><span class="error"><?= Str::e($error) ?></span><?php endif; ?>
    </div>

    <div class="field">
      <label for="email">Email address <span class="required">*</span></label>
      <input class="input" type="email" id="email" name="email" required autocomplete="email"
             value="<?= Str::e($invitedEmail !== '' ? $invitedEmail : Flash::old('email')) ?>"
             <?= Flash::errorFor('email') ? 'aria-invalid="true"' : '' ?>>
      <?php if ($error = Flash::errorFor('email')): ?><span class="error"><?= Str::e($error) ?></span><?php endif; ?>
    </div>

    <div class="field">
      <label for="password">Password <span class="required">*</span></label>
      <input class="input" type="password" id="password" name="password" required autocomplete="new-password"
             minlength="8" <?= Flash::errorFor('password') ? 'aria-invalid="true"' : '' ?>>
      <span class="hint">At least 8 characters, with an uppercase letter and a number.</span>
      <?php if ($error = Flash::errorFor('password')): ?><span class="error"><?= Str::e($error) ?></span><?php endif; ?>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="country">Country <span class="required">*</span></label>
        <select class="select" id="country" name="country" data-country-select>
          <?php foreach (Currency::COUNTRIES as $row): ?>
            <option value="<?= Str::e($row['code']) ?>" data-currency="<?= Str::e($row['currency']) ?>"
                    <?= (Flash::old('country', $defaultCountry) === $row['code']) ? 'selected' : '' ?>>
              <?= Str::e($row['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>

      <div class="field">
        <label for="currency">Billing currency <span class="required">*</span></label>
        <select class="select" id="currency" name="currency" data-currency-select>
          <?php foreach (Currency::LIST as $code => $meta): ?>
            <option value="<?= Str::e($code) ?>"
                    <?= (Flash::old('currency', $defaultCurrency) === $code) ? 'selected' : '' ?>>
              <?= Str::e($meta['flag'] . ' ' . $code . ' — ' . $meta['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
        <span class="hint">Changeable before you subscribe.</span>
      </div>
    </div>

    <div class="field">
      <label for="relationship_type">What kind of relationship is this?</label>
      <select class="select" id="relationship_type" name="relationship_type">
        <?= View::options($relationshipTypes, Flash::old('relationship_type', 'romantic')) ?>
      </select>
      <span class="hint">This only changes the labels. Every relationship type uses the same framework.</span>
    </div>

    <label class="checkbox mt-3">
      <input type="checkbox" name="accept_terms" value="1" required>
      <span class="muted">
        I agree to the <a href="/terms-of-service">Terms of Service</a> and
        <a href="/privacy-policy">Privacy Policy</a>.
      </span>
    </label>

    <label class="checkbox mt-2">
      <input type="checkbox" name="marketing" value="1" checked>
      <span class="muted">Send me the weekly fairness tips email. Unsubscribe any time.</span>
    </label>

    <button class="btn btn-lg btn-block mt-3" type="submit">Create my free account</button>

    <?php if (Settings::bool('require_email_verification', true)): ?>
      <p class="tiny muted center mt-2">We will email you a confirmation link before your account is activated.</p>
    <?php endif; ?>
  </form>

  <?php View::partial('partials/google-button', ['label' => 'Sign up with Google']); ?>

  <p class="center small muted mt-3">
    Already have an account? <a href="/signin">Sign in</a>
  </p>
<?php endif; ?>

<?php View::end(); Flash::clearOld(); Flash::clearErrors(); ?>
