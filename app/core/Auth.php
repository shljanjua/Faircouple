<?php
declare(strict_types=1);

/**
 * Sign-in, sign-up, sessions and the couple context.
 *
 * A PHP session holds the user id plus a `sid` that points at a row in the
 * `sessions` table. Deleting that row — on a password change, a suspension or
 * an admin action — signs the person out everywhere on their next request.
 */
final class Auth
{
    private static ?array $user = null;
    private static bool $resolved = false;
    private static ?array $context = null;
    private static bool $contextResolved = false;
    private static ?array $entitlements = null;

    public const SESSION_DAYS = 30;

    /* --------------------------------------------------------------- Session */

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }

        $secure = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';

        session_name('fc_session');
        session_set_cookie_params([
            'lifetime' => self::SESSION_DAYS * 86400,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        @session_start();
    }

    /** The signed-in member, or null. Resolved once per request. */
    public static function user(): ?array
    {
        if (self::$resolved) {
            return self::$user;
        }
        self::$resolved = true;

        $userId = $_SESSION['uid'] ?? null;
        $sid    = $_SESSION['sid'] ?? null;
        if (!$userId || !$sid) {
            return null;
        }

        $session = Db::one(
            'SELECT id FROM sessions WHERE id = ? AND user_id = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1',
            [$sid, $userId]
        );
        if (!$session) {
            self::forget();
            return null;
        }

        $profile = Db::one(
            'SELECT p.*, u.email_verified_at AS login_verified_at, u.disabled_at
               FROM profiles p
               JOIN users u ON u.id = p.id
              WHERE p.id = ? AND p.deleted_at IS NULL AND u.disabled_at IS NULL
              LIMIT 1',
            [$userId]
        );

        if (!$profile || in_array($profile['status'], ['suspended', 'banned'], true)) {
            self::forget();
            return null;
        }

        $profile['notification_prefs'] = Str::json($profile['notification_prefs'], [
            'email' => true, 'push' => true, 'weekly_report' => true, 'partner_activity' => true,
        ]);

        self::$user = $profile;
        return self::$user;
    }

    public static function id(): ?string
    {
        $user = self::user();
        return $user['id'] ?? null;
    }

    public static function check(): bool
    {
        return self::user() !== null;
    }

    public static function isAdmin(): bool
    {
        $user = self::user();
        return $user !== null && in_array($user['role'], ['admin', 'superadmin'], true);
    }

    public static function isSuperAdmin(): bool
    {
        $user = self::user();
        return $user !== null && $user['role'] === 'superadmin';
    }

    /** Redirects to sign-in unless somebody is signed in. */
    public static function require(): array
    {
        $user = self::user();
        if ($user === null) {
            Response::redirect('/signin?next=' . urlencode(Request::path()));
        }
        return $user;
    }

    public static function requireAdmin(): array
    {
        $user = self::require();
        if (!self::isAdmin()) {
            Response::redirect('/dashboard');
        }
        return $user;
    }

    /* ---------------------------------------------------------------- Sign in */

    /** @return array{ok:bool,error?:string,redirect?:string} */
    public static function signIn(string $email, string $password): array
    {
        $email = strtolower(trim($email));

        $row = Db::one(
            'SELECT u.id, u.email, u.password_hash, u.email_verified_at, u.disabled_at,
                    p.role, p.status, p.full_name
               FROM users u
               JOIN profiles p ON p.id = u.id
              WHERE u.email = ? AND p.deleted_at IS NULL
              LIMIT 1',
            [$email]
        );

        // Always spend roughly the same time whether or not the account exists.
        $hash = $row['password_hash'] ?? '$2y$12$usesomesillystringfore7hnbRJHxXVLeakoG8K30M1MlGPHhu';
        $valid = password_verify($password, $hash);

        if (!$row || !$valid || $row['disabled_at'] !== null) {
            return ['ok' => false, 'error' => 'Incorrect email or password.'];
        }

        if (in_array($row['status'], ['suspended', 'banned'], true)) {
            return ['ok' => false, 'error' => 'This account is suspended. Please contact support.'];
        }

        if (Settings::bool('require_email_verification', true) && !$row['email_verified_at']) {
            return [
                'ok' => false,
                'error' => 'Please confirm your email address first — check your inbox for the link.',
            ];
        }

        self::issueSession($row['id']);

        Db::run(
            'UPDATE profiles SET last_seen_at = UTC_TIMESTAMP(), last_login_ip = ?, login_count = login_count + 1 WHERE id = ?',
            [Request::ip(), $row['id']]
        );

        return ['ok' => true, 'redirect' => '/dashboard'];
    }

    /** @return array{ok:bool,error?:string,field?:string,verify?:bool} */
    public static function signUp(array $input): array
    {
        if (!Settings::bool('signup_enabled', true)) {
            return ['ok' => false, 'error' => 'New signups are paused right now.'];
        }

        $name     = trim((string) ($input['full_name'] ?? ''));
        $email    = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');
        $country  = strtoupper(trim((string) ($input['country'] ?? 'US')));
        $currency = Currency::normalise((string) ($input['currency'] ?? 'USD'));

        if (mb_strlen($name) < 2) {
            return ['ok' => false, 'error' => 'Please enter your name.', 'field' => 'full_name'];
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Enter a valid email address.', 'field' => 'email'];
        }

        $passwordError = self::passwordProblem($password);
        if ($passwordError !== null) {
            return ['ok' => false, 'error' => $passwordError, 'field' => 'password'];
        }

        if (empty($input['accept_terms'])) {
            return ['ok' => false, 'error' => 'You must accept the terms to continue.', 'field' => 'accept_terms'];
        }

        if (Db::one('SELECT id FROM users WHERE email = ? LIMIT 1', [$email])) {
            return ['ok' => false, 'error' => 'An account already exists with that email.', 'field' => 'email'];
        }

        $userId = Str::uuid();
        $needsVerification = Settings::bool('require_email_verification', true);
        $verifiedAt = $needsVerification ? null : Str::now();

        Db::begin();
        $created = Db::run(
            'INSERT INTO users (id, email, password_hash, email_verified_at) VALUES (?, ?, ?, ?)',
            [$userId, $email, password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]), $verifiedAt]
        );

        if (!$created['ok']) {
            Db::rollback();
            return ['ok' => false, 'error' => $created['error'] ?? 'Could not create your account.'];
        }

        $profile = Db::run(
            'INSERT INTO profiles
               (id, email, full_name, display_name, currency, country_code, locale, timezone,
                marketing_opt_in, referral_code, email_verified_at, notification_prefs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                $userId,
                $email,
                $name,
                explode(' ', $name)[0],
                $currency,
                $country === 'OTHER' ? null : substr($country, 0, 2),
                'en',
                (string) ($input['timezone'] ?? 'UTC'),
                !empty($input['marketing']) ? 1 : 0,
                strtoupper(bin2hex(random_bytes(5))),
                $verifiedAt,
                json_encode(['email' => true, 'push' => true, 'weekly_report' => true, 'partner_activity' => true]),
            ]
        );

        if (!$profile['ok']) {
            Db::rollback();
            return ['ok' => false, 'error' => $profile['error'] ?? 'Could not create your profile.'];
        }
        Db::commit();

        if (!empty($input['marketing'])) {
            Db::run(
                'INSERT INTO newsletter_subscribers (id, email, name, source, status)
                 VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE status = "subscribed"',
                [Str::uuid(), $email, $name, 'signup', 'subscribed']
            );
        }

        Audit::record('auth.signup', 'user', $userId, 'New account from ' . $country, [], $userId, $email);

        if ($needsVerification) {
            self::sendVerification($userId, $email, $name);
            return ['ok' => true, 'verify' => true];
        }

        self::issueSession($userId);
        Mailer::template('welcome', $email, [
            'name'        => $name,
            'confirm_url' => Config::siteUrl('/dashboard'),
        ], $userId);

        return ['ok' => true, 'verify' => false];
    }

    /**
     * Sign in — or create — an account from a verified Google profile.
     *
     * Google has already confirmed the email, so a matching account is linked
     * and signed straight in, and a brand-new one skips email verification.
     * Passwordless: the login row is created with no password hash, and the
     * person can set one later from Settings if they ever want to.
     *
     * @param array $g A profile from GoogleAuth::userInfo()['profile'].
     * @return array{ok:bool,error?:string,new?:bool}
     */
    public static function signInWithGoogle(array $g): array
    {
        $email = strtolower(trim((string) ($g['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Google did not share a usable email address.'];
        }

        $existing = Db::one(
            'SELECT u.id, u.disabled_at, p.status
               FROM users u JOIN profiles p ON p.id = u.id
              WHERE u.email = ? AND p.deleted_at IS NULL
              LIMIT 1',
            [$email]
        );

        // ---- Existing account: link and sign in ----------------------------
        if ($existing) {
            if ($existing['disabled_at'] !== null || in_array($existing['status'], ['suspended', 'banned'], true)) {
                return ['ok' => false, 'error' => 'This account is not available. Please contact support.'];
            }

            Db::run('UPDATE users SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?', [$existing['id']]);
            Db::run(
                'UPDATE profiles
                    SET email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()),
                        avatar_url = COALESCE(NULLIF(avatar_url, ""), ?),
                        last_seen_at = UTC_TIMESTAMP(), last_login_ip = ?, login_count = login_count + 1
                  WHERE id = ?',
                [$g['picture'] ?? null, Request::ip(), $existing['id']]
            );

            self::issueSession($existing['id']);
            Audit::record('auth.google.signin', 'user', $existing['id'], 'Signed in with Google', [], $existing['id'], $email);
            return ['ok' => true, 'new' => false];
        }

        // ---- New account: register -----------------------------------------
        if (!Settings::bool('signup_enabled', true)) {
            return ['ok' => false, 'error' => 'New signups are paused right now.'];
        }

        $name    = trim((string) ($g['name'] ?? '')) ?: (explode('@', $email)[0]);
        $first   = trim((string) ($g['given_name'] ?? '')) ?: explode(' ', $name)[0];
        $country = strtoupper((string) (Request::header('CF-IPCountry') ?? 'US'));
        $country = preg_match('/^[A-Z]{2}$/', $country) ? $country : 'US';
        $userId  = Str::uuid();

        Db::begin();
        $created = Db::run(
            'INSERT INTO users (id, email, password_hash, email_verified_at) VALUES (?, ?, NULL, UTC_TIMESTAMP())',
            [$userId, $email]
        );
        if (!$created['ok']) {
            Db::rollback();
            return ['ok' => false, 'error' => $created['error'] ?? 'Could not create your account.'];
        }

        $profile = Db::run(
            'INSERT INTO profiles
               (id, email, full_name, display_name, avatar_url, currency, country_code, locale, timezone,
                marketing_opt_in, referral_code, email_verified_at, onboarded_at, notification_prefs)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), NULL, ?)',
            [
                $userId,
                $email,
                $name,
                $first,
                ($g['picture'] ?? '') !== '' ? $g['picture'] : null,
                Currency::forCountry($country),
                $country,
                'en',
                'UTC',
                0,
                strtoupper(bin2hex(random_bytes(5))),
                json_encode(['email' => true, 'push' => true, 'weekly_report' => true, 'partner_activity' => true]),
            ]
        );
        if (!$profile['ok']) {
            Db::rollback();
            return ['ok' => false, 'error' => $profile['error'] ?? 'Could not create your profile.'];
        }
        Db::commit();

        Audit::record('auth.google.signup', 'user', $userId, 'New account via Google', [], $userId, $email);

        self::issueSession($userId);
        Mailer::template('welcome', $email, [
            'name'        => $name,
            'confirm_url' => Config::siteUrl('/dashboard'),
        ], $userId);

        return ['ok' => true, 'new' => true];
    }

    public static function signOut(): void
    {
        $sid = $_SESSION['sid'] ?? null;
        if ($sid) {
            Db::delete('sessions', 'id = ?', [$sid]);
        }
        self::forget();
    }

    private static function forget(): void
    {
        self::$user = null;
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        @session_destroy();
        self::start();
    }

    public static function issueSession(string $userId): void
    {
        session_regenerate_id(true);
        $sid = Str::uuid();

        Db::insert('sessions', [
            'id'         => $sid,
            'user_id'    => $userId,
            'ip_address' => Request::ip(),
            'user_agent' => mb_substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 250),
            'expires_at' => Str::inDays(self::SESSION_DAYS),
        ]);

        $_SESSION['uid'] = $userId;
        $_SESSION['sid'] = $sid;
        self::$resolved = false;
    }

    /* ------------------------------------------------------------- Passwords */

    public static function passwordProblem(string $password): ?string
    {
        if (strlen($password) < 8) {
            return 'Use at least 8 characters.';
        }
        if (!preg_match('/[a-z]/', $password)) {
            return 'Include a lowercase letter.';
        }
        if (!preg_match('/[A-Z]/', $password)) {
            return 'Include an uppercase letter.';
        }
        if (!preg_match('/[0-9]/', $password)) {
            return 'Include a number.';
        }
        return null;
    }

    public static function sendVerification(string $userId, string $email, ?string $name = null): void
    {
        $token = Str::token();
        Db::delete('auth_tokens', 'user_id = ? AND kind = "verify"', [$userId]);
        Db::insert('auth_tokens', [
            'user_id'    => $userId,
            'kind'       => 'verify',
            'token_hash' => Str::hashToken($token),
            'expires_at' => Str::inHours(24),
        ]);

        Mailer::template('welcome', $email, [
            'name'        => $name ?: explode('@', $email)[0],
            'confirm_url' => Config::siteUrl('/verify-email?token=' . $token),
        ], $userId);
    }

    /** @return array{ok:bool,error?:string} */
    public static function verifyEmail(string $token): array
    {
        $row = Db::one(
            'SELECT t.id, t.user_id, u.email, p.full_name
               FROM auth_tokens t
               JOIN users u ON u.id = t.user_id
               JOIN profiles p ON p.id = t.user_id
              WHERE t.token_hash = ? AND t.kind = "verify"
                AND t.used_at IS NULL AND t.expires_at > UTC_TIMESTAMP()
              LIMIT 1',
            [Str::hashToken($token)]
        );

        if (!$row) {
            return ['ok' => false, 'error' => 'This link is invalid or has expired. Request a new one below.'];
        }

        Db::run('UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ?', [$row['user_id']]);
        Db::run('UPDATE profiles SET email_verified_at = UTC_TIMESTAMP() WHERE id = ?', [$row['user_id']]);
        Db::run('UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [$row['id']]);

        self::issueSession($row['user_id']);
        return ['ok' => true];
    }

    /** Always reports success so the form cannot be used to find accounts. */
    public static function requestPasswordReset(string $email): void
    {
        $row = Db::one(
            'SELECT u.id, u.email, p.full_name FROM users u JOIN profiles p ON p.id = u.id WHERE u.email = ? LIMIT 1',
            [strtolower(trim($email))]
        );
        if (!$row) {
            return;
        }

        $token = Str::token();
        Db::delete('auth_tokens', 'user_id = ? AND kind = "reset"', [$row['id']]);
        Db::insert('auth_tokens', [
            'user_id'    => $row['id'],
            'kind'       => 'reset',
            'token_hash' => Str::hashToken($token),
            'expires_at' => Str::inHours(1),
        ]);

        Mailer::template('password-reset', $row['email'], [
            'name'      => $row['full_name'] ?: 'there',
            'reset_url' => Config::siteUrl('/reset-password?token=' . $token),
        ], $row['id']);
    }

    /** @return array{ok:bool,error?:string} */
    public static function resetPassword(string $token, string $password, string $confirm): array
    {
        $problem = self::passwordProblem($password);
        if ($problem !== null) {
            return ['ok' => false, 'error' => $problem];
        }
        if ($password !== $confirm) {
            return ['ok' => false, 'error' => 'The two passwords do not match.'];
        }

        $row = Db::one(
            'SELECT id, user_id FROM auth_tokens
              WHERE token_hash = ? AND kind = "reset" AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
              LIMIT 1',
            [Str::hashToken($token)]
        );
        if (!$row) {
            return ['ok' => false, 'error' => 'This reset link is invalid or has expired.'];
        }

        Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [
            password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]),
            $row['user_id'],
        ]);
        Db::run('UPDATE auth_tokens SET used_at = UTC_TIMESTAMP() WHERE id = ?', [$row['id']]);
        Db::delete('sessions', 'user_id = ?', [$row['user_id']]);

        Audit::record('auth.password_reset', 'user', $row['user_id'], 'Password reset completed', [], $row['user_id']);

        return ['ok' => true];
    }

    /** @return array{ok:bool,error?:string} */
    public static function changePassword(string $current, string $new): array
    {
        $user = self::user();
        if (!$user) {
            return ['ok' => false, 'error' => 'Not signed in.'];
        }

        $problem = self::passwordProblem($new);
        if ($problem !== null) {
            return ['ok' => false, 'error' => $problem];
        }

        $hash = Db::value('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
        if (!$hash || !password_verify($current, (string) $hash)) {
            return ['ok' => false, 'error' => 'Your current password is incorrect.'];
        }

        Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [
            password_hash($new, PASSWORD_BCRYPT, ['cost' => 12]),
            $user['id'],
        ]);
        Db::delete('sessions', 'user_id = ? AND id <> ?', [$user['id'], $_SESSION['sid'] ?? '']);

        return ['ok' => true];
    }

    /* ---------------------------------------------------------- Couple space */

    /**
     * The caller's relationship space, its members and the partner.
     *
     * @return array{couple:array,members:array,me:array,partner:?array}|null
     */
    public static function couple(): ?array
    {
        if (self::$contextResolved) {
            return self::$context;
        }
        self::$contextResolved = true;

        $user = self::user();
        if (!$user) {
            return null;
        }

        $membership = Db::one(
            'SELECT couple_id FROM couple_members WHERE user_id = ? AND removed_at IS NULL LIMIT 1',
            [$user['id']]
        );
        if (!$membership) {
            return null;
        }

        $couple = Db::one('SELECT * FROM couples WHERE id = ? LIMIT 1', [$membership['couple_id']]);
        if (!$couple) {
            return null;
        }

        $members = Db::all(
            'SELECT m.*, p.email, p.full_name, p.display_name, p.avatar_url, p.currency, p.country_code
               FROM couple_members m
               LEFT JOIN profiles p ON p.id = m.user_id
              WHERE m.couple_id = ? AND m.removed_at IS NULL
              ORDER BY m.joined_at ASC',
            [$couple['id']]
        );

        $me = null;
        $partner = null;
        foreach ($members as $member) {
            if ($member['user_id'] === $user['id']) {
                $me = $member;
            } else {
                $partner = $member;
            }
        }

        self::$context = [
            'couple'  => $couple,
            'members' => $members,
            'me'      => $me ?? ['user_id' => $user['id'], 'display_role' => 'Partner A'],
            'partner' => $partner,
        ];

        return self::$context;
    }

    /** Redirects to onboarding when the member has no space yet. */
    public static function requireCouple(): array
    {
        self::require();
        $context = self::couple();
        if ($context === null) {
            Response::redirect('/onboarding');
        }
        return $context;
    }

    public static function coupleId(): ?string
    {
        $context = self::couple();
        return $context['couple']['id'] ?? null;
    }

    /* ------------------------------------------------------------ Plan limits */

    /**
     * The effective plan for the signed-in member. A partner's paid plan covers
     * both people in the space, so nobody has to pay twice.
     *
     * @return array{plan:array,limits:array,subscription:?array,is_paid:bool}
     */
    public static function entitlements(): array
    {
        if (self::$entitlements !== null) {
            return self::$entitlements;
        }

        $user = self::user();
        $free = Plans::freeEntitlements();

        if (!$user) {
            return self::$entitlements = $free;
        }

        // Superadmins run the whole product, so they always hold full lifetime
        // access — no billing row required.
        if ($user['role'] === 'superadmin') {
            return self::$entitlements = Plans::fullEntitlements();
        }

        $userIds = [$user['id']];
        $context = self::couple();
        if ($context) {
            foreach ($context['members'] as $member) {
                $userIds[] = $member['user_id'];
            }
        }
        $userIds = array_values(array_unique($userIds));

        $row = Db::one(
            'SELECT s.*, p.slug AS plan_slug, p.name AS plan_name, p.tier, p.limits, p.is_free
               FROM subscriptions s
               JOIN plans p ON p.id = s.plan_id
              WHERE s.user_id IN (' . Db::placeholders($userIds) . ')
                AND s.status IN ("active","trialing")
                AND (s.current_period_end IS NULL OR s.current_period_end > UTC_TIMESTAMP())
              ORDER BY p.tier DESC
              LIMIT 1',
            $userIds
        );

        if (!$row) {
            return self::$entitlements = $free;
        }

        return self::$entitlements = [
            'plan'         => ['slug' => $row['plan_slug'], 'name' => $row['plan_name'], 'tier' => (int) $row['tier']],
            'limits'       => Plans::mergeLimits(Str::json($row['limits'])),
            'subscription' => $row,
            'is_paid'      => !Str::bool($row['is_free']),
        ];
    }

    /** Confirms a row belongs to the caller's space before it is touched. */
    public static function ownsRow(string $table, string $id): bool
    {
        $coupleId = self::coupleId();
        if (!$coupleId) {
            return false;
        }
        return Db::one("SELECT id FROM `{$table}` WHERE id = ? AND couple_id = ? LIMIT 1", [$id, $coupleId]) !== null;
    }
}
