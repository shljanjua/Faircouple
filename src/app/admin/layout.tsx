import { requireAdmin } from '@/lib/auth';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();

  return (
    <AdminShell
      name={user.profile.full_name ?? user.email}
      email={user.email}
      role={user.profile.role}
      avatar={user.profile.avatar_url}
    >
      {children}
    </AdminShell>
  );
}
