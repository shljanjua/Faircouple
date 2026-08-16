import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import { Card, Table, Td, Th } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Audit log', noIndex: true });
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const supabase = createAdminClient();
  const page = Math.max(1, Number(searchParams.page ?? 1));
  const pageSize = 60;

  const { data: logs, count } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Audit log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {count ?? 0} recorded actions. Every admin change, role grant, refund and deletion is
          logged with the actor, IP address and user agent.
        </p>
      </header>

      <Card className="p-5">
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Summary</Th>
              <Th>IP</Th>
            </tr>
          </thead>
          <tbody>
            {((logs ?? []) as any[]).map((log) => (
              <tr key={log.id}>
                <Td className="whitespace-nowrap text-muted-foreground">
                  {formatDateTime(log.created_at)}
                </Td>
                <Td className="text-xs">{log.actor_email ?? log.actor_id ?? 'system'}</Td>
                <Td className="font-mono text-xs">{log.action}</Td>
                <Td className="text-xs text-muted-foreground">
                  {log.entity_type}
                  {log.entity_id ? ` · ${String(log.entity_id).slice(0, 8)}` : ''}
                </Td>
                <Td className="max-w-md text-xs">{log.summary ?? '—'}</Td>
                <Td className="font-mono text-xs text-muted-foreground">{log.ip_address ?? '—'}</Td>
              </tr>
            ))}
          </tbody>
        </Table>

        {(count ?? 0) > pageSize && (
          <nav className="mt-4 flex justify-between text-sm" aria-label="Pagination">
            {page > 1 ? (
              <a href={`/admin/audit?page=${page - 1}`} className="text-primary underline">
                Previous
              </a>
            ) : (
              <span />
            )}
            {page * pageSize < (count ?? 0) && (
              <a href={`/admin/audit?page=${page + 1}`} className="text-primary underline">
                Next
              </a>
            )}
          </nav>
        )}
      </Card>
    </div>
  );
}
