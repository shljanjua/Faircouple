import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { getAllSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { EmailsManager } from '@/components/admin/emails-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Email & SMTP', noIndex: true });
}

export default async function AdminEmailsPage() {
  const supabase = createAdminClient();
  const [{ data: templates }, { data: logs }, settings] = await Promise.all([
    supabase.from('email_templates').select('*').order('slug'),
    supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50),
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
    <EmailsManager
      templates={(templates ?? []) as any[]}
      logs={(logs ?? []) as any[]}
      smtp={smtp}
    />
  );
}
