import type { Metadata } from 'next';
import { getAllSettings } from '@/lib/settings';
import { buildMetadata } from '@/lib/seo';
import { SettingsEditor } from '@/components/admin/settings-editor';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Settings', noIndex: true });
}

export default async function AdminSettingsPage() {
  const settings = await getAllSettings();
  return <SettingsEditor settings={settings} />;
}
