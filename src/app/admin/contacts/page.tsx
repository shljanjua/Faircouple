import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { deleteRowAction, updateContactStatusAction } from '@/app/actions/admin';
import { ActionButton } from '@/components/admin/form-shell';
import { Badge, Card, Table, Td, Th } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Inbox', noIndex: true });
}

export default async function AdminContactsPage() {
  const [messages, subscribers] = await Promise.all([
    query<any>(`SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT 100`),
    query<any>(`SELECT * FROM newsletter_subscribers ORDER BY created_at DESC LIMIT 200`),
  ]);

  const csv = subscribers
    .map((subscriber) => `${subscriber.email},${subscriber.status},${subscriber.created_at}`)
    .join('\n');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Inbox &amp; subscribers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact form submissions and newsletter signups.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="font-semibold">Contact messages</h2>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Received</Th>
                <Th>From</Th>
                <Th>Message</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id}>
                  <Td className="whitespace-nowrap text-muted-foreground">
                    {formatDateTime(message.created_at)}
                  </Td>
                  <Td>
                    <span className="font-medium">{message.name}</span>
                    <a
                      href={`mailto:${message.email}`}
                      className="block text-xs text-primary underline"
                    >
                      {message.email}
                    </a>
                  </Td>
                  <Td className="max-w-lg">
                    {message.subject && <span className="block font-medium">{message.subject}</span>}
                    <span className="text-xs text-muted-foreground">{message.message}</span>
                  </Td>
                  <Td>
                    <Badge
                      tone={
                        message.status === 'new'
                          ? 'warning'
                          : message.status === 'replied'
                            ? 'success'
                            : 'outline'
                      }
                    >
                      {message.status}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap justify-end gap-2">
                      <ActionButton
                        label="Mark replied"
                        action={() => updateContactStatusAction(message.id, 'replied')}
                      />
                      <ActionButton
                        label="Spam"
                        variant="ghost"
                        action={() => updateContactStatusAction(message.id, 'spam')}
                      />
                      <ActionButton
                        label="Delete"
                        variant="ghost"
                        confirm="Delete this message?"
                        action={() => deleteRowAction('contact_messages', message.id)}
                      />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Newsletter subscribers ({subscribers.length})</h2>
          <a
            href={`data:text/csv;charset=utf-8,${encodeURIComponent(`email,status,created_at\n${csv}`)}`}
            download="faircouples-subscribers.csv"
            className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
          >
            Download CSV
          </a>
        </div>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Email</Th>
                <Th>Source</Th>
                <Th>Status</Th>
                <Th>Joined</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((subscriber) => (
                <tr key={subscriber.id}>
                  <Td>{subscriber.email}</Td>
                  <Td className="text-muted-foreground">{subscriber.source ?? '—'}</Td>
                  <Td>
                    <Badge tone={subscriber.status === 'subscribed' ? 'success' : 'outline'}>
                      {subscriber.status}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">{formatDateTime(subscriber.created_at)}</Td>
                  <Td className="text-right">
                    <ActionButton
                      label="Remove"
                      variant="ghost"
                      action={() => deleteRowAction('newsletter_subscribers', subscriber.id)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
