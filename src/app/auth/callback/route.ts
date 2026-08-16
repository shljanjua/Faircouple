import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Handles every Supabase redirect: email confirmation, magic links, password
 * recovery and OAuth. Exchanges the code for a session, then routes the user
 * to the right next step (invite acceptance, checkout, onboarding).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const errorDescription = searchParams.get('error_description');

  const invite = searchParams.get('invite');
  const plan = searchParams.get('plan');
  const currency = searchParams.get('currency');
  const interval = searchParams.get('interval');
  const next = searchParams.get('next');

  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/signin?notice=error&message=${encodeURIComponent(errorDescription)}`
    );
  }

  const supabase = createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(
        `${origin}/signin?notice=error&message=${encodeURIComponent(error.message)}`
      );
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as any,
      token_hash: tokenHash,
    });
    if (error) {
      return NextResponse.redirect(
        `${origin}/signin?notice=error&message=${encodeURIComponent(error.message)}`
      );
    }
  } else {
    return NextResponse.redirect(`${origin}/signin`);
  }

  if (type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`);
  }

  if (invite) {
    return NextResponse.redirect(`${origin}/invite/${invite}`);
  }

  if (plan && plan !== 'free') {
    const params = new URLSearchParams({ plan });
    if (currency) params.set('currency', currency);
    if (interval) params.set('interval', interval);
    return NextResponse.redirect(`${origin}/checkout?${params.toString()}`);
  }

  if (next) {
    return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : `/${next}`}`);
  }

  return NextResponse.redirect(`${origin}/onboarding`);
}
