'use client';

import { useState } from 'react';
import { saveEmailTemplateAction, saveSettingsAction, sendTestEmailAction, verifySmtpAction } from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function EmailsManager({
  templates,
  logs,
  smtp,
}: {
  templates: any[];
  logs: any[];
  smtp: Record<string, any>;
}) {
  const [tab, setTab] = useState<'smtp' | 'templates' | 'logs'>('smtp');
  const [selected, setSelected] = useState(templates[0]?.slug ?? '');
  const [testEmail, setTestEmail] = useState('');

  const template = templates.find((item) => item.slug === selected);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Email &amp; SMTP</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Hostinger (or any) SMTP account, edit every transactional email and inspect
          the delivery log.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: 'smtp', label: 'SMTP settings' },
          { key: 'templates', label: 'Templates' },
          { key: 'logs', label: 'Delivery log' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key as typeof tab)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === item.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card hover:bg-secondary'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'smtp' && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold">SMTP credentials</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              For Hostinger: host <code>smtp.hostinger.com</code>, port 465 with SSL, or 587 with
              TLS. Use the full mailbox address as the username.
            </p>

            <AdminForm action={saveSettingsAction} className="mt-4" submitLabel="Save SMTP settings">
              <input
                type="hidden"
                name="__booleans"
                value="smtp_secure,email_enabled,email_admin_notifications"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="SMTP host" htmlFor="smtp_host">
                  <Input
                    id="smtp_host"
                    name="setting:smtp_host"
                    defaultValue={smtp.smtp_host}
                    placeholder="smtp.hostinger.com"
                  />
                </Field>
                <Field label="Port" htmlFor="smtp_port">
                  <Input
                    id="smtp_port"
                    name="setting:smtp_port"
                    type="number"
                    defaultValue={smtp.smtp_port}
                  />
                </Field>
                <Field label="Username" htmlFor="smtp_user">
                  <Input
                    id="smtp_user"
                    name="setting:smtp_user"
                    defaultValue={smtp.smtp_user}
                    autoComplete="off"
                  />
                </Field>
                <Field
                  label="Password"
                  htmlFor="smtp_password"
                  hint={smtp.hasPassword ? 'Saved — leave blank to keep it.' : undefined}
                >
                  <Input
                    id="smtp_password"
                    name="setting:smtp_password"
                    type="password"
                    placeholder={smtp.hasPassword ? '••••••••••••' : ''}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="From email" htmlFor="smtp_from_email">
                  <Input
                    id="smtp_from_email"
                    name="setting:smtp_from_email"
                    type="email"
                    defaultValue={smtp.smtp_from_email}
                  />
                </Field>
                <Field label="From name" htmlFor="smtp_from_name">
                  <Input
                    id="smtp_from_name"
                    name="setting:smtp_from_name"
                    defaultValue={smtp.smtp_from_name}
                  />
                </Field>
                <Field label="Reply-to" htmlFor="smtp_reply_to">
                  <Input
                    id="smtp_reply_to"
                    name="setting:smtp_reply_to"
                    type="email"
                    defaultValue={smtp.smtp_reply_to}
                  />
                </Field>
                <div className="flex flex-col justify-end gap-3 pb-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="setting:smtp_secure"
                      value="true"
                      defaultChecked={smtp.smtp_secure === true}
                      className="h-4 w-4 rounded"
                    />
                    Use SSL (port 465)
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="setting:email_enabled"
                      value="true"
                      defaultChecked={smtp.email_enabled === true}
                      className="h-4 w-4 rounded"
                    />
                    Email sending enabled
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="setting:email_admin_notifications"
                      value="true"
                      defaultChecked={smtp.email_admin_notifications === true}
                      className="h-4 w-4 rounded"
                    />
                    Notify admins of signups and payments
                  </label>
                </div>
              </div>
            </AdminForm>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Test your configuration</h2>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="min-w-[240px] flex-1">
                <Field label="Send a test email to" htmlFor="test_email">
                  <Input
                    id="test_email"
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
              </div>
              <ActionButton
                label="Send test email"
                variant="primary"
                size="md"
                action={() => sendTestEmailAction(testEmail)}
              />
              <ActionButton label="Verify connection" action={() => verifySmtpAction()} />
            </div>
          </Card>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
          <Card className="p-3">
            <ul className="space-y-1">
              {templates.map((item) => (
                <li key={item.slug}>
                  <button
                    type="button"
                    onClick={() => setSelected(item.slug)}
                    className={cn(
                      'w-full rounded-lg px-3 py-2 text-left text-sm',
                      selected === item.slug
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'hover:bg-secondary'
                    )}
                  >
                    {item.name}
                    {!item.is_active && (
                      <Badge tone="outline" className="ml-2">
                        off
                      </Badge>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {template && (
            <Card className="p-5">
              <h2 className="font-semibold">{template.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
              {template.variables?.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Variables:{' '}
                  {template.variables.map((variable: string) => (
                    <code key={variable} className="mr-1 rounded bg-secondary px-1">
                      {`{{${variable}}}`}
                    </code>
                  ))}
                </p>
              )}

              <AdminForm
                action={saveEmailTemplateAction}
                className="mt-4"
                submitLabel="Save template"
                footer={
                  <ActionButton
                    label="Send preview"
                    action={() => sendTestEmailAction(testEmail, template.slug)}
                  />
                }
              >
                <input type="hidden" name="slug" value={template.slug} />
                <div className="space-y-4">
                  <Field label="Name" htmlFor={`name-${template.slug}`}>
                    <Input id={`name-${template.slug}`} name="name" defaultValue={template.name} />
                  </Field>
                  <Field label="Subject" htmlFor={`subject-${template.slug}`}>
                    <Input
                      id={`subject-${template.slug}`}
                      name="subject"
                      defaultValue={template.subject}
                    />
                  </Field>
                  <Field label="HTML body" htmlFor={`html-${template.slug}`}>
                    <Textarea
                      id={`html-${template.slug}`}
                      name="html_body"
                      rows={14}
                      className="font-mono text-xs"
                      defaultValue={template.html_body}
                    />
                  </Field>
                  <Field label="Plain-text fallback" htmlFor={`text-${template.slug}`}>
                    <Textarea
                      id={`text-${template.slug}`}
                      name="text_body"
                      rows={3}
                      defaultValue={template.text_body ?? ''}
                    />
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="is_active"
                      defaultChecked={template.is_active}
                      className="h-4 w-4 rounded"
                    />
                    Active
                  </label>
                </div>
              </AdminForm>
            </Card>
          )}
        </div>
      )}

      {tab === 'logs' && (
        <Card className="p-5">
          <h2 className="font-semibold">Delivery log</h2>
          {logs.some((log) => log.status === 'failed') && (
            <Alert tone="warning" className="mt-3">
              Some emails failed. Check the SMTP credentials and your provider&apos;s sending limits.
            </Alert>
          )}
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Sent</Th>
                  <Th>To</Th>
                  <Th>Subject</Th>
                  <Th>Template</Th>
                  <Th>Status</Th>
                  <Th>Error</Th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(log.created_at)}
                    </Td>
                    <Td className="text-xs">{log.to_email}</Td>
                    <Td className="max-w-xs truncate text-xs">{log.subject}</Td>
                    <Td className="text-xs text-muted-foreground">{log.template_slug ?? '—'}</Td>
                    <Td>
                      <Badge tone={log.status === 'sent' ? 'success' : 'danger'}>{log.status}</Badge>
                    </Td>
                    <Td className="max-w-xs truncate text-xs text-destructive">{log.error ?? ''}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
