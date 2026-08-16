import type { Metadata } from 'next';
import { getSessionUser } from '@/lib/auth';
import { buildMetadata } from '@/lib/seo';
import { SettingsWorkspace } from '@/components/app/settings-workspace';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Settings', path: '/dashboard/settings', noIndex: true });
}

export default async function SettingsPage() {
  const user = await getSessionUser();
  return <SettingsWorkspace profile={user!.profile} />;
}
