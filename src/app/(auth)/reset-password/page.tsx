import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Choose a new password',
    path: '/reset-password',
    noIndex: true,
  });
}

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
