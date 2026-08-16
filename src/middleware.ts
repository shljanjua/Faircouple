import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/session';

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/checkout'];
const ADMIN_PREFIX = '/admin';
const AUTH_ROUTES = ['/signin', '/signup', '/forgot-password'];

/**
 * Session verification only — the JWT is signed, so the Edge runtime can check
 * it without touching MySQL. Role changes still take effect immediately
 * because every page re-reads the profile from the database.
 */
export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAdmin = pathname.startsWith(ADMIN_PREFIX);
  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  if ((isProtected || isAdmin) && !session) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && session) {
    const url = request.nextUrl.clone();
    url.pathname = searchParams.get('next') || '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (isAdmin && session && session.role !== 'admin' && session.role !== 'superadmin') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, images and the files that must stay
     * reachable anonymously (sitemap, robots, favicons).
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml|api/files|og|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)',
  ],
};
