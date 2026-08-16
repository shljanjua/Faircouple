import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PROTECTED_PREFIXES = ['/dashboard', '/onboarding', '/checkout'];
const ADMIN_PREFIX = '/admin';
const AUTH_ROUTES = ['/signin', '/signup', '/forgot-password'];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const { response, user, supabase } = await updateSession(request);

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAdmin = pathname.startsWith(ADMIN_PREFIX);
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname === p);

  if ((isProtected || isAdmin) && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/signin';
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = searchParams.get('next') || '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (isAdmin && user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, status')
      .eq('id', user.id)
      .maybeSingle();

    const role = (profile as any)?.role;
    if (role !== 'admin' && role !== 'superadmin') {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on every route except static assets, images and the files that must
     * be reachable anonymously (sitemap, robots, favicons).
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|robots.txt|sitemap.xml|sitemaps|og|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|xml|txt)$).*)',
  ],
};
