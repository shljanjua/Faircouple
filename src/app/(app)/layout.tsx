import { redirect } from 'next/navigation';
import { getSessionUser, getCoupleContext, getEntitlements } from '@/lib/auth';
import { AppShell } from '@/components/app/app-shell';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/signin?next=%2Fdashboard');

  const [context, entitlements] = await Promise.all([getCoupleContext(), getEntitlements()]);

  return (
    <AppShell
      profile={user.profile}
      couple={context?.couple ?? null}
      partnerName={context?.partner?.profile?.full_name ?? null}
      planName={entitlements.planName}
      isPaid={entitlements.isPaid}
    >
      {children}
    </AppShell>
  );
}
