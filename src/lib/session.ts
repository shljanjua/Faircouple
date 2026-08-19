import { SignJWT, jwtVerify } from 'jose';

/**
 * Stateless session cookie, signed with HS256 so it can be verified in the
 * Edge middleware as well as in Node server actions. The cookie carries only
 * the user id and role; everything else is read from MySQL.
 */

export const SESSION_COOKIE = 'fc_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export interface SessionPayload {
  sub: string;
  email: string;
  role: string;
  sid: string;
}

function secretKey(): Uint8Array {
  const secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    'faircouples-development-secret-change-me-in-production';
  return new TextEncoder().encode(secret.padEnd(32, '.'));
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role, sid: payload.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setIssuer('faircouples')
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secretKey());
}

export async function verifySession(token?: string | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: 'faircouples' });
    if (!payload.sub) return null;
    return {
      sub: String(payload.sub),
      email: String(payload.email ?? ''),
      role: String(payload.role ?? 'user'),
      sid: String(payload.sid ?? ''),
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: SESSION_MAX_AGE,
};
