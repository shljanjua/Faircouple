'use client';

import Link from 'next/link';
import { adminRemoveMemberAction } from '@/app/actions/couple';
import { ActionButton } from '@/components/admin/form-shell';
import { Badge, Table, Td, Th } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export function CouplesTable({
  couples,
  page,
  pageSize,
  total,
}: {
  couples: any[];
  page: number;
  pageSize: number;
  total: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <Table>
        <thead>
          <tr>
            <Th>Space</Th>
            <Th>Type</Th>
            <Th>Members</Th>
            <Th>Created</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {couples.map((couple) => {
            const active = (couple.members ?? []).filter((member: any) => !member.removed_at);
            return (
              <tr key={couple.id}>
                <Td>
                  <span className="font-medium">{couple.name ?? 'Untitled space'}</span>
                  <span className="block text-xs text-muted-foreground">{couple.currency}</span>
                </Td>
                <Td>
                  <Badge tone="outline">{couple.relationship_type.replace(/_/g, ' ')}</Badge>
                </Td>
                <Td>
                  <ul className="space-y-1">
                    {active.map((member: any) => (
                      <li key={member.id} className="text-xs">
                        <span className="font-medium">
                          {member.profile?.full_name ?? member.profile?.email ?? 'Member'}
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {member.display_role ?? member.member_role}
                        </span>
                      </li>
                    ))}
                    {active.length === 1 && (
                      <li className="text-xs text-amber-600 dark:text-amber-400">
                        Waiting for a second member
                      </li>
                    )}
                  </ul>
                </Td>
                <Td className="text-muted-foreground">{formatDate(couple.created_at)}</Td>
                <Td>
                  <div className="flex flex-col items-end gap-2">
                    {active.map((member: any) => (
                      <ActionButton
                        key={member.id}
                        label={`Remove ${(member.profile?.full_name ?? 'member').split(' ')[0]}`}
                        variant="ghost"
                        confirm="Remove this member from the space?"
                        action={() => adminRemoveMemberAction(couple.id, member.user_id)}
                      />
                    ))}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/couples?page=${page - 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-secondary"
              >
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={`/admin/couples?page=${page + 1}`}
                className="rounded-lg border border-border px-3 py-1.5 hover:bg-secondary"
              >
                Next
              </Link>
            )}
          </div>
        </nav>
      )}
    </div>
  );
}
