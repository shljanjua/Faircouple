import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';
import { getAllSettings, settingBool, settingString } from '@/lib/settings';

export const dynamic = 'force-dynamic';

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  subject: z.string().max(200).optional(),
  message: z.string().min(10).max(5000),
  category: z.string().max(40).optional(),
  website: z.string().optional(), // honeypot
});

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Please check the form and try again.' },
      { status: 400 }
    );
  }

  // Honeypot: silently accept so bots do not learn they were caught.
  if (parsed.data.website) {
    return NextResponse.json({ ok: true });
  }

  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('contact_messages').insert({
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      subject: parsed.data.subject ?? null,
      message: parsed.data.message,
      category: parsed.data.category ?? 'general',
      ip_address: ip,
    });

    if (error) throw new Error(error.message);

    // Auto-reply to the sender.
    await sendEmail({
      to: parsed.data.email,
      template: 'contact-received',
      variables: { name: parsed.data.name },
    });

    // Notify the support inbox.
    const settings = await getAllSettings();
    if (settingBool(settings, 'email_admin_notifications', true)) {
      const supportEmail = settingString(settings, 'support_email');
      if (supportEmail) {
        await sendEmail({
          to: supportEmail,
          subject: `New contact form message: ${parsed.data.subject ?? parsed.data.category ?? 'general'}`,
          html: `<p><strong>${parsed.data.name}</strong> (${parsed.data.email}) wrote:</p><p>${parsed.data.message.replace(/</g, '&lt;')}</p>`,
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not send your message.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
