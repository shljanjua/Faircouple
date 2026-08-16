'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { savePaymentGatewayAction } from '@/app/actions/admin';
import { AdminForm } from '@/components/admin/form-shell';
import { Alert, Badge, Card, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';
import { formatMoney } from '@/lib/currency';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const CREDENTIAL_FIELDS: Record<string, { key: string; label: string; hint?: string }[]> = {
  stripe: [
    { key: 'publishable_key', label: 'Publishable key', hint: 'pk_live_… or pk_test_…' },
    { key: 'secret_key', label: 'Secret key', hint: 'sk_live_… or sk_test_…' },
    { key: 'webhook_secret', label: 'Webhook signing secret', hint: 'whsec_…' },
  ],
  paypal: [
    { key: 'client_id', label: 'Client ID' },
    { key: 'client_secret', label: 'Client secret' },
    { key: 'webhook_id', label: 'Webhook ID' },
  ],
  manual: [{ key: 'instructions', label: 'Bank transfer instructions' }],
};

export function PaymentsManager({
  gateways,
  payments,
  webhooks,
  siteUrl,
}: {
  gateways: any[];
  payments: any[];
  webhooks: any[];
  siteUrl: string;
}) {
  const [tab, setTab] = useState<'gateways' | 'transactions' | 'webhooks'>('gateways');
  const [copied, setCopied] = useState<string | null>(null);

  const totalRevenue = payments
    .filter((payment) => payment.status === 'succeeded')
    .reduce((sum, payment) => sum + (payment.amount_cents ?? 0), 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure Stripe and PayPal, review every transaction and inspect webhook delivery.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: 'gateways', label: 'Gateways' },
          { key: 'transactions', label: 'Transactions' },
          { key: 'webhooks', label: 'Webhook log' },
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

      {tab === 'gateways' && (
        <div className="space-y-5">
          <Alert tone="info" title="Webhook endpoints">
            <p className="mt-1">Register these URLs with each provider:</p>
            <ul className="mt-2 space-y-1 font-mono text-xs">
              {[
                { label: 'Stripe', url: `${siteUrl}/api/webhooks/stripe` },
                { label: 'PayPal', url: `${siteUrl}/api/webhooks/paypal` },
              ].map((endpoint) => (
                <li key={endpoint.label} className="flex items-center gap-2">
                  <span className="font-sans font-medium">{endpoint.label}:</span>
                  {endpoint.url}
                  <button
                    type="button"
                    aria-label={`Copy ${endpoint.label} webhook URL`}
                    onClick={() => {
                      navigator.clipboard.writeText(endpoint.url);
                      setCopied(endpoint.label);
                      setTimeout(() => setCopied(null), 2000);
                    }}
                    className="rounded p-1 hover:bg-secondary"
                  >
                    {copied === endpoint.label ? (
                      <Check className="h-3 w-3" aria-hidden />
                    ) : (
                      <Copy className="h-3 w-3" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Alert>

          {gateways.map((gateway) => (
            <Card key={gateway.provider} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-semibold capitalize">
                    {gateway.display_name ?? gateway.provider}
                    <Badge tone={gateway.is_enabled ? 'success' : 'outline'}>
                      {gateway.is_enabled ? 'enabled' : 'disabled'}
                    </Badge>
                    <Badge tone={gateway.mode === 'live' ? 'warning' : 'info'}>{gateway.mode}</Badge>
                  </h2>
                  {gateway.instructions && (
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                      {gateway.instructions}
                    </p>
                  )}
                </div>
              </div>

              <AdminForm
                action={savePaymentGatewayAction}
                className="mt-4"
                submitLabel={`Save ${gateway.provider}`}
              >
                <input type="hidden" name="provider" value={gateway.provider} />
                <input type="hidden" name="display_name" value={gateway.display_name ?? gateway.provider} />

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mode" htmlFor={`mode-${gateway.provider}`}>
                    <Select id={`mode-${gateway.provider}`} name="mode" defaultValue={gateway.mode}>
                      <option value="test">Test / sandbox</option>
                      <option value="live">Live</option>
                    </Select>
                  </Field>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <input
                      type="checkbox"
                      name="is_enabled"
                      defaultChecked={gateway.is_enabled}
                      className="h-4 w-4 rounded"
                    />
                    Enable this payment method
                  </label>

                  {(CREDENTIAL_FIELDS[gateway.provider] ?? []).map((field) => (
                    <Field
                      key={field.key}
                      label={field.label}
                      hint={
                        gateway.credentialsPresent?.[field.key]
                          ? 'Saved — leave blank to keep the current value.'
                          : field.hint
                      }
                      htmlFor={`${gateway.provider}-${field.key}`}
                    >
                      <Input
                        id={`${gateway.provider}-${field.key}`}
                        name={`cred:${field.key}`}
                        type={field.key.includes('secret') ? 'password' : 'text'}
                        placeholder={
                          gateway.credentialsPresent?.[field.key] ? '••••••••••••' : field.hint
                        }
                        autoComplete="off"
                      />
                    </Field>
                  ))}

                  <Field
                    label="Customer-facing instructions"
                    htmlFor={`instructions-${gateway.provider}`}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      id={`instructions-${gateway.provider}`}
                      name="instructions"
                      rows={2}
                      defaultValue={gateway.instructions ?? ''}
                    />
                  </Field>
                </div>
              </AdminForm>
            </Card>
          ))}
        </div>
      )}

      {tab === 'transactions' && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Recent transactions</h2>
            <span className="text-sm text-muted-foreground">
              {formatMoney(totalRevenue, 'USD', { showDecimals: false })} collected in this view
            </span>
          </div>
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Customer</Th>
                  <Th>Provider</Th>
                  <Th>Description</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(payment.created_at)}
                    </Td>
                    <Td className="text-xs">{payment.billing_email ?? '—'}</Td>
                    <Td className="capitalize text-muted-foreground">{payment.provider}</Td>
                    <Td className="text-xs">{payment.description ?? '—'}</Td>
                    <Td>
                      <Badge
                        tone={
                          payment.status === 'succeeded'
                            ? 'success'
                            : payment.status === 'failed'
                              ? 'danger'
                              : 'warning'
                        }
                      >
                        {payment.status}
                      </Badge>
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatMoney(payment.amount_cents, payment.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      )}

      {tab === 'webhooks' && (
        <Card className="p-5">
          <h2 className="font-semibold">Webhook deliveries</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Every event is stored, so a failed delivery can be diagnosed without leaving the panel.
          </p>
          <div className="mt-4">
            <Table>
              <thead>
                <tr>
                  <Th>Received</Th>
                  <Th>Provider</Th>
                  <Th>Event</Th>
                  <Th>Status</Th>
                  <Th>Error</Th>
                </tr>
              </thead>
              <tbody>
                {webhooks.map((event) => (
                  <tr key={event.id}>
                    <Td className="whitespace-nowrap text-muted-foreground">
                      {formatDateTime(event.created_at)}
                    </Td>
                    <Td className="capitalize">{event.provider}</Td>
                    <Td className="font-mono text-xs">{event.event_type}</Td>
                    <Td>
                      <Badge
                        tone={
                          event.status === 'processed'
                            ? 'success'
                            : event.status === 'failed'
                              ? 'danger'
                              : 'outline'
                        }
                      >
                        {event.status}
                      </Badge>
                    </Td>
                    <Td className="text-xs text-destructive">{event.error ?? ''}</Td>
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
