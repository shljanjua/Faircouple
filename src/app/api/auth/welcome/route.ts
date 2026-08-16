import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { sendEmail } from '@/lib/email';
import { getAllSettings, settingBool, settingString } from '@/lib/settings';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
});

/**
 * Sends the branded welcome/verification email through the SMTP account
 * configured in the admin panel. Supabase also sends its own confirmation
 * link; this gives the same message your branding and copy.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email.' }, { status: 400 });
  }

  try {
    const settings = await getAllSettings();
    if (!settingBool(settings, 'email_enabled', true) || !settingString(settings, 'smtp_host')) {
      // SMTP not configured — Supabase's own email still goes out.
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Supabase mails the signed confirmation link itself; this branded email
    // points at the verification page, where the link can also be re-sent.
    const confirmUrl = `${SITE_URL}/verify-email?email=${encodeURIComponent(parsed.data.email)}`;

    await sendEmail({
      to: parsed.data.email,
      template: 'welcome',
      variables: {
        name: parsed.data.name ?? parsed.data.email.split('@')[0],
        confirm_url: confirmUrl,
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    // Never surface auth-side errors to the browser during signup.
    return NextResponse.json({ ok: true });
  }
}
