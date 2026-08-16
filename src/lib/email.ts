import nodemailer from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/server';
import { getAllSettings, settingBool, settingNumber, settingString } from '@/lib/settings';

export interface SendEmailOptions {
  to: string;
  subject?: string;
  html?: string;
  text?: string;
  template?: string;
  variables?: Record<string, string | number | null | undefined>;
  userId?: string | null;
}

function interpolate(template: string, variables: Record<string, unknown>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    const value = variables[key];
    return value === null || value === undefined ? '' : String(value);
  });
}

/**
 * Sends mail through the SMTP credentials configured in the admin panel.
 * Every send is logged to `email_logs` whether it succeeds or fails.
 */
export async function sendEmail(options: SendEmailOptions) {
  const supabase = createAdminClient();
  const settings = await getAllSettings();

  let subject = options.subject ?? '';
  let html = options.html ?? '';
  let text = options.text ?? '';

  if (options.template) {
    const { data: tpl } = await supabase
      .from('email_templates')
      .select('subject, html_body, text_body, is_active')
      .eq('slug', options.template)
      .maybeSingle();

    if (tpl && (tpl as any).is_active) {
      const vars = {
        site_name: settingString(settings, 'site_name', 'FairCouples'),
        site_url: settingString(settings, 'site_url', ''),
        support_email: settingString(settings, 'support_email', ''),
        ...(options.variables ?? {}),
      };
      subject = interpolate((tpl as any).subject, vars);
      html = interpolate((tpl as any).html_body, vars);
      text = interpolate((tpl as any).text_body ?? '', vars);
    }
  }

  const fromEmail = settingString(settings, 'smtp_from_email', 'no-reply@faircouples.com');
  const fromName = settingString(settings, 'smtp_from_name', 'FairCouples');

  const logRow = {
    to_email: options.to,
    from_email: fromEmail,
    subject,
    template_slug: options.template ?? null,
    user_id: options.userId ?? null,
    provider: 'smtp',
  };

  if (!settingBool(settings, 'email_enabled', true)) {
    await supabase.from('email_logs').insert({
      ...logRow,
      status: 'failed',
      error: 'Email sending is disabled in admin settings.',
    });
    return { ok: false, error: 'Email sending is disabled.' };
  }

  const host = settingString(settings, 'smtp_host');
  const user = settingString(settings, 'smtp_user');
  const pass = settingString(settings, 'smtp_password');

  if (!host || !user) {
    await supabase.from('email_logs').insert({
      ...logRow,
      status: 'failed',
      error: 'SMTP is not configured. Add credentials in Admin → Email.',
    });
    return { ok: false, error: 'SMTP is not configured.' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: settingNumber(settings, 'smtp_port', 587),
      secure: settingBool(settings, 'smtp_secure', false),
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      replyTo: settingString(settings, 'smtp_reply_to', fromEmail) || undefined,
      to: options.to,
      subject,
      html,
      text: text || stripHtml(html),
    });

    await supabase.from('email_logs').insert({
      ...logRow,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown SMTP error';
    await supabase.from('email_logs').insert({ ...logRow, status: 'failed', error: message });
    return { ok: false, error: message };
  }
}

export async function verifySmtp() {
  const settings = await getAllSettings();
  const host = settingString(settings, 'smtp_host');
  if (!host) return { ok: false, error: 'No SMTP host configured.' };

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: settingNumber(settings, 'smtp_port', 587),
      secure: settingBool(settings, 'smtp_secure', false),
      auth: {
        user: settingString(settings, 'smtp_user'),
        pass: settingString(settings, 'smtp_password'),
      },
    });
    await transporter.verify();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Verification failed' };
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
