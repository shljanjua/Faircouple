import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { SignUpForm } from '@/components/auth/signup-form';
import { buildMetadata } from '@/lib/seo';
import { currencyForCountry } from '@/lib/currency';
import { getPublicSettings, settingBool } from '@/lib/settings';
import { Alert } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Create your free account',
    description:
      'Start measuring fairness in your relationship. Free forever plan, no card required. Choose your billing currency — USD, GBP, EUR, CAD or AUD.',
    path: '/signup',
    noIndex: false,
  });
}

export default async function SignUpPage() {
  const settings = await getPublicSettings();
  const headerList = headers();
  const detectedCountry =
    headerList.get('x-vercel-ip-country') ??
    headerList.get('cf-ipcountry') ??
    headerList.get('x-country-code') ??
    null;

  if (!settingBool(settings, 'signup_enabled', true)) {
    return (
      <Alert tone="warning" title="Signups are paused">
        New accounts are temporarily disabled. Please check back shortly.
      </Alert>
    );
  }

  return (
    <Suspense>
      <SignUpForm
        defaultCountry={detectedCountry?.toUpperCase() ?? ''}
        defaultCurrency={currencyForCountry(detectedCountry)}
        requireVerification={settingBool(settings, 'require_email_verification', true)}
      />
    </Suspense>
  );
}
