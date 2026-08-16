import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { deleteCouponAction, saveCouponAction } from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Badge, Card, Field, Input, Select, Table, Td, Th } from '@/components/ui';
import { CURRENCY_LIST, formatMoney } from '@/lib/currency';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Coupons', noIndex: true });
}

export default async function AdminCouponsPage() {
  const coupons = await query<any>(`SELECT * FROM coupons ORDER BY created_at DESC`);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Coupons</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Discount codes for campaigns and win-backs. Stripe promotion codes are also accepted at
          checkout.
        </p>
      </header>

      <Card className="p-5">
        <h2 className="font-semibold">Create or update a coupon</h2>
        <AdminForm action={saveCouponAction} className="mt-4" submitLabel="Save coupon" resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Code" required htmlFor="code">
              <Input id="code" name="code" required placeholder="LOVE20" className="uppercase" />
            </Field>
            <Field label="Type" htmlFor="discount_type">
              <Select id="discount_type" name="discount_type" defaultValue="percent">
                <option value="percent">Percent off</option>
                <option value="fixed">Fixed amount off</option>
              </Select>
            </Field>
            <Field label="Duration" htmlFor="duration">
              <Select id="duration" name="duration" defaultValue="once">
                <option value="once">Once</option>
                <option value="repeating">Repeating</option>
                <option value="forever">Forever</option>
              </Select>
            </Field>
            <Field label="Percent off" htmlFor="percent_off">
              <Input id="percent_off" name="percent_off" type="number" min="1" max="100" />
            </Field>
            <Field label="Amount off" htmlFor="amount_off">
              <Input id="amount_off" name="amount_off" type="number" step="0.01" min="0" />
            </Field>
            <Field label="Currency (fixed only)" htmlFor="currency">
              <Select id="currency" name="currency" defaultValue="">
                <option value="">—</option>
                {CURRENCY_LIST.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.code}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Max redemptions" htmlFor="max_redemptions">
              <Input id="max_redemptions" name="max_redemptions" type="number" min="1" />
            </Field>
            <Field label="Expires" htmlFor="expires_at">
              <Input id="expires_at" name="expires_at" type="date" />
            </Field>
            <Field label="Description" htmlFor="description">
              <Input id="description" name="description" />
            </Field>
            <label className="flex items-end gap-2 pb-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 rounded" />
              Active
            </label>
          </div>
        </AdminForm>
      </Card>

      <Table>
        <thead>
          <tr>
            <Th>Code</Th>
            <Th>Discount</Th>
            <Th>Duration</Th>
            <Th>Redeemed</Th>
            <Th>Expires</Th>
            <Th>Status</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {coupons.map((coupon) => (
            <tr key={coupon.id}>
              <Td className="font-mono font-medium">{coupon.code}</Td>
              <Td>
                {coupon.discount_type === 'percent'
                  ? `${coupon.percent_off}%`
                  : formatMoney(coupon.amount_off_cents ?? 0, coupon.currency ?? 'USD')}
              </Td>
              <Td className="capitalize text-muted-foreground">{coupon.duration}</Td>
              <Td className="text-muted-foreground">
                {coupon.redeemed_count}
                {coupon.max_redemptions ? ` / ${coupon.max_redemptions}` : ''}
              </Td>
              <Td className="text-muted-foreground">
                {coupon.expires_at ? formatDate(coupon.expires_at) : 'Never'}
              </Td>
              <Td>
                <Badge tone={coupon.is_active ? 'success' : 'outline'}>
                  {coupon.is_active ? 'active' : 'inactive'}
                </Badge>
              </Td>
              <Td className="text-right">
                <ActionButton
                  label="Delete"
                  variant="ghost"
                  confirm="Delete this coupon?"
                  action={() => deleteCouponAction(coupon.id)}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
