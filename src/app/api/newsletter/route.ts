import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { execute, uuid } from '@/lib/db';

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

  const country = request.headers.get('cf-ipcountry') ?? null;

  const result = await execute(
    `INSERT INTO newsletter_subscribers (id, email, name, source, country_code, status)
     VALUES (?, ?, ?, ?, ?, 'subscribed')
     ON DUPLICATE KEY UPDATE
       name            = COALESCE(VALUES(name), name),
       source          = VALUES(source),
       country_code    = COALESCE(VALUES(country_code), country_code),
       status          = 'subscribed',
       unsubscribed_at = NULL`,
    [
      uuid(),
      parsed.data.email.toLowerCase(),
      parsed.data.name ?? null,
      parsed.data.source ?? 'footer',
      country,
    ]
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Could not subscribe you.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
