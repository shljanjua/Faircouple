import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { getAllSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { EmailsManager } from '@/components/admin/emails-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Email & SMTP', noIndex: true });
}

export default async function AdminEmailsPage() {
  const [templates, logs, settings] = await Promise.all([
    query<any>(`SELECT * FROM email_templates ORDER BY slug ASC`),
    query<any>(`SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 50`),
    getAllSettings(),
  ]);

  // Only report whether a password exists — never send it to the browser.
  const smtp = {
    smtp_host: settings.smtp_host ?? '',
    smtp_port: settings.smtp_port ?? 587,
    smtp_secure: settings.smtp_secure ?? false,
    smtp_user: settings.smtp_user ?? '',
    smtp_from_email: settings.smtp_from_email ?? '',
    smtp_from_name: settings.smtp_from_name ?? '',
    smtp_reply_to: settings.smtp_reply_to ?? '',
    email_enabled: settings.email_enabled ?? true,
    email_admin_notifications: settings.email_admin_notifications ?? true,
    hasPassword: Boolean(settings.smtp_password),
  };

  return (
    <EmailsManager templates={templates} logs={logs} smtp={smtp} />
  );
}
