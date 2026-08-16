import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getSessionUser, getCoupleContext } from '@/lib/auth';
import { OnboardingWizard } from '@/components/app/onboarding-wizard';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Set up your space', path: '/onboarding', noIndex: true });
}

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=%2Fonboarding');

  const context = await getCoupleContext();
  if (context) redirect('/dashboard');

  return <OnboardingWizard defaultName={`${user.profile.full_name ?? 'Our'} space`} />;
}
