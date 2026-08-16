'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Copy, Pencil } from 'lucide-react';
import {
  deleteUserAction,
  grantPlanAction,
  impersonationLinkAction,
  updateUserAction,
} from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Badge, Card, Field, Input, Select, Table, Td, Th } from '@/components/ui';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';

interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  currency: string;
  country_code: string | null;
  created_at: string;
  last_seen_at: string | null;
  suspended_reason: string | null;
}

export function UsersTable({
  users,
  plans,
  planByUser,
  myId,
  myRole,
  page,
  pageSize,
  total,
}: {
  users: UserRow[];
  plans: { id: string; name: string }[];
  planByUser: Record<string, string>;
  myId: string;
  myRole: string;
  page: number;
  pageSize: number;
  total: number;
}) {
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <Table>
        <thead>
          <tr>
            <Th>User</Th>
            <Th>Role</Th>
            <Th>Plan</Th>
            <Th>Status</Th>
            <Th>Joined</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <Td>
                <span className="font-medium">{user.full_name ?? '—'}</span>
                <span className="block text-xs text-muted-foreground">{user.email}</span>
                <span className="block text-xs text-muted-foreground">
                  {user.country_code ?? '—'} · {user.currency}
                </span>
              </Td>
              <Td>
                <Badge
                  tone={
                    user.role === 'superadmin' ? 'primary' : user.role === 'admin' ? 'info' : 'default'
                  }
                >
                  {user.role}
                </Badge>
              </Td>
              <Td className="text-muted-foreground">{planByUser[user.id] ?? 'Free'}</Td>
              <Td>
                <Badge
                  tone={
                    user.status === 'active'
                      ? 'success'
                      : user.status === 'suspended'
                        ? 'warning'
                        : 'danger'
                  }
                >
                  {user.status}
                </Badge>
              </Td>
              <Td className="text-muted-foreground">{formatDate(user.created_at)}</Td>
              <Td>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(user)}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                    Edit
                  </Button>
                  {myRole === 'superadmin' && user.id !== myId && (
                    <ActionButton
                      label="Login link"
                      variant="ghost"
                      action={async () => {
                        const result = await impersonationLinkAction(user.id);
                        if (result.ok && result.data) setMagicLink(result.data as string);
                        return result;
                      }}
                    />
                  )}
                  {user.id !== myId && (
                    <ActionButton
                      label="Delete"
                      variant="ghost"
                      confirm="Permanently delete this user?"
                      action={() => deleteUserAction(user.id)}
                    />
                  )}
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      {magicLink && (
        <Card className="p-4">
          <p className="text-sm font-medium">One-time sign-in link (support use only)</p>
          <div className="mt-2 flex gap-2">
            <Input readOnly value={magicLink} className="text-xs" aria-label="Sign-in link" />
            <Button
              variant="outline"
              aria-label="Copy link"
              onClick={() => navigator.clipboard.writeText(magicLink)}
            >
              <Copy className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            This link signs you in as the user. Its use is recorded in the audit log.
          </p>
        </Card>
      )}

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/users?page=${page - 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-secondary"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/users?page=${page + 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-secondary"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}

      {editing && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-semibold">{editing.full_name ?? editing.email}</h2>
                <p className="text-sm text-muted-foreground">{editing.email}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Close
              </Button>
            </div>

            <AdminForm action={updateUserAction} className="mt-5" submitLabel="Save user">
              <input type="hidden" name="user_id" value={editing.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Role" htmlFor="role">
                  <Select id="role" name="role" defaultValue={editing.role}>
                    <option value="user">User</option>
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                    {myRole === 'superadmin' && <option value="superadmin">Superadmin</option>}
                  </Select>
                </Field>
                <Field label="Status" htmlFor="status">
                  <Select id="status" name="status" defaultValue={editing.status}>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="banned">Banned</option>
                    <option value="pending_deletion">Pending deletion</option>
                  </Select>
                </Field>
              </div>
              <Field
                label="Reason (shown in the audit log)"
                htmlFor="suspended_reason"
                className="mt-4"
              >
                <Input
                  id="suspended_reason"
                  name="suspended_reason"
                  defaultValue={editing.suspended_reason ?? ''}
                />
              </Field>
            </AdminForm>

            <div className="mt-6 border-t border-border pt-5">
              <h3 className="font-semibold">Grant a plan manually</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Use for refunds, comps and support cases. Creates a manual subscription.
              </p>
              <AdminForm action={grantPlanAction} className="mt-3" submitLabel="Grant plan">
                <input type="hidden" name="user_id" value={editing.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Plan" htmlFor="plan_id">
                    <Select id="plan_id" name="plan_id" defaultValue={plans[0]?.id ?? ''}>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Months" htmlFor="months">
                    <Input id="months" name="months" type="number" min="1" max="120" defaultValue={12} />
                  </Field>
                </div>
              </AdminForm>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
