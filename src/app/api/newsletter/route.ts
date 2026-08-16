import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const schema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  source: z.string().max(60).optional(),
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
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }

  const country =
    request.headers.get('x-vercel-ip-country') ?? request.headers.get('cf-ipcountry') ?? null;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('newsletter_subscribers').upsert(
      {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name ?? null,
        source: parsed.data.source ?? 'footer',
        country_code: country,
        status: 'subscribed',
      },
      { onConflict: 'email' }
    );

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not subscribe you.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
