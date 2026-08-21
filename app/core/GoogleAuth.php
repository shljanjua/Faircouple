<?php
declare(strict_types=1);

/**
 * "Sign in with Google" using the OAuth 2.0 authorization-code flow.
 *
 * No SDK, no Composer, no JWT crypto: the browser is sent to Google, Google
 * sends it back to /auth/google/callback with a one-time code, and we exchange
 * that code for the user's profile over a direct HTTPS call to Google. Because
 * that exchange is server-to-server over TLS, the profile it returns is trusted
 * without any local signature checking.
 *
 * Everything is driven from Admin → Settings → Social login: the feature can be
 * switched off, and the Client ID and secret live in the database.
 */
final class GoogleAuth
{
    private const AUTH_ENDPOINT     = 'https://accounts.google.com/o/oauth2/v2/auth';
    private const TOKEN_ENDPOINT     = 'https://oauth2.googleapis.com/token';
    private const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo';

    /** True when an admin has both switched the feature on and saved credentials. */
    public static function enabled(): bool
    {
        return Settings::bool('google_auth_enabled', false) && self::configured();
    }

    /** True when both the Client ID and secret are present. */
    public static function configured(): bool
    {
        return self::clientId() !== '' && self::clientSecret() !== '';
    }

    public static function clientId(): string
    {
        return trim(Settings::text('google_client_id'));
    }

    public static function clientSecret(): string
    {
        return trim(Settings::text('google_client_secret'));
    }

    /** The exact redirect URI to whitelist in the Google Cloud console. */
    public static function redirectUri(): string
    {
        return Config::siteUrl('/auth/google/callback');
    }

    /** The Google consent-screen URL the visitor is sent to. */
    public static function authUrl(string $state): string
    {
        $params = [
            'client_id'     => self::clientId(),
            'redirect_uri'  => self::redirectUri(),
            'response_type' => 'code',
            'scope'         => 'openid email profile',
            'state'         => $state,
            'access_type'   => 'online',
            'prompt'        => 'select_account',
            'include_granted_scopes' => 'true',
        ];

        return self::AUTH_ENDPOINT . '?' . http_build_query($params);
    }

    /**
     * Swap the one-time code for an access token.
     *
     * @return array{ok:bool,access_token?:string,error?:string}
     */
    public static function exchangeCode(string $code): array
    {
        $result = self::post(self::TOKEN_ENDPOINT, [
            'code'          => $code,
            'client_id'     => self::clientId(),
            'client_secret' => self::clientSecret(),
            'redirect_uri'  => self::redirectUri(),
            'grant_type'    => 'authorization_code',
        ]);

        if (!$result['ok']) {
            return ['ok' => false, 'error' => $result['error']];
        }
        if (empty($result['data']['access_token'])) {
            return ['ok' => false, 'error' => 'Google did not return an access token.'];
        }

        return ['ok' => true, 'access_token' => (string) $result['data']['access_token']];
    }

    /**
     * Fetch the signed-in Google user's profile.
     *
     * @return array{ok:bool,profile?:array,error?:string}
     */
    public static function userInfo(string $accessToken): array
    {
        $result = self::get(self::USERINFO_ENDPOINT, $accessToken);

        if (!$result['ok']) {
            return ['ok' => false, 'error' => $result['error']];
        }

        $data  = $result['data'];
        $email = strtolower(trim((string) ($data['email'] ?? '')));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'error' => 'Google did not share a usable email address.'];
        }

        return [
            'ok' => true,
            'profile' => [
                'sub'            => (string) ($data['sub'] ?? ''),
                'email'          => $email,
                'email_verified' => !empty($data['email_verified']),
                'name'           => trim((string) ($data['name'] ?? '')),
                'given_name'     => trim((string) ($data['given_name'] ?? '')),
                'picture'        => trim((string) ($data['picture'] ?? '')),
                'locale'         => trim((string) ($data['locale'] ?? '')),
            ],
        ];
    }

    /* ------------------------------------------------------------------ cURL */

    /** @return array{ok:bool,data:array,error:?string} */
    private static function post(string $url, array $form): array
    {
        return self::request('POST', $url, http_build_query($form), [
            'Content-Type: application/x-www-form-urlencoded',
            'Accept: application/json',
        ]);
    }

    /** @return array{ok:bool,data:array,error:?string} */
    private static function get(string $url, string $bearer): array
    {
        return self::request('GET', $url, null, [
            'Authorization: Bearer ' . $bearer,
            'Accept: application/json',
        ]);
    }

    /** @return array{ok:bool,data:array,error:?string} */
    private static function request(string $method, string $url, ?string $body, array $headers): array
    {
        if (!function_exists('curl_init')) {
            return ['ok' => false, 'data' => [], 'error' => 'The cURL extension is not available on this server.'];
        }

        $handle = curl_init($url);
        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST  => $method,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        $raw       = curl_exec($handle);
        $status    = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
        $curlError = curl_error($handle);
        curl_close($handle);

        if ($raw === false) {
            return ['ok' => false, 'data' => [], 'error' => $curlError ?: 'Could not reach Google.'];
        }

        $data = json_decode((string) $raw, true);
        $data = is_array($data) ? $data : [];

        if ($status >= 400) {
            $message = $data['error_description']
                ?? (is_string($data['error'] ?? null) ? $data['error'] : null)
                ?? ('Google returned HTTP ' . $status . '.');
            return ['ok' => false, 'data' => $data, 'error' => (string) $message];
        }

        return ['ok' => true, 'data' => $data, 'error' => null];
    }
}
