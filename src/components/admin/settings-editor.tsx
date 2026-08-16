'use client';

import { useState } from 'react';
import { saveSettingsAction } from '@/app/actions/admin';
import { AdminForm } from '@/components/admin/form-shell';
import { Card, Field, Input, Select, Textarea } from '@/components/ui';
import type { SettingsMap } from '@/lib/settings-utils';
import { cn } from '@/lib/utils';

type FieldType = 'text' | 'textarea' | 'boolean' | 'number' | 'list' | 'url' | 'email';

interface SettingField {
  key: string;
  label: string;
  hint?: string;
  type?: FieldType;
  placeholder?: string;
}

const GROUPS: { id: string; label: string; description: string; fields: SettingField[] }[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Brand, contact details and platform-wide switches.',
    fields: [
      { key: 'site_name', label: 'Site name' },
      { key: 'site_tagline', label: 'Tagline' },
      { key: 'site_description', label: 'Default meta description', type: 'textarea' },
      { key: 'site_url', label: 'Site URL', type: 'url', hint: 'Used for canonicals and sitemaps.' },
      { key: 'support_email', label: 'Support email', type: 'email' },
      { key: 'contact_phone', label: 'Contact phone' },
      { key: 'company_name', label: 'Legal company name' },
      { key: 'company_address', label: 'Registered address', type: 'textarea' },
      { key: 'default_currency', label: 'Default currency' },
      { key: 'supported_currencies', label: 'Supported currencies', type: 'list' },
      { key: 'trial_days', label: 'Default trial length (days)', type: 'number' },
      { key: 'signup_enabled', label: 'Allow new signups', type: 'boolean' },
      {
        key: 'require_email_verification',
        label: 'Require email verification',
        type: 'boolean',
        hint: 'New accounts must confirm their address before using the app.',
      },
      {
        key: 'maintenance_mode',
        label: 'Maintenance mode',
        type: 'boolean',
        hint: 'Hides the public site from everyone except admins.',
      },
      { key: 'feature_ads_on_free', label: 'Show ads on the free plan', type: 'boolean' },
      { key: 'feature_blog_enabled', label: 'Blog enabled', type: 'boolean' },
      { key: 'feature_referrals_enabled', label: 'Referral programme', type: 'boolean' },
    ],
  },
  {
    id: 'seo',
    label: 'SEO defaults',
    description: 'Titles, robots directives and search-engine verification tokens.',
    fields: [
      { key: 'seo_default_title', label: 'Default title tag' },
      { key: 'seo_title_template', label: 'Title template', hint: 'Use %s for the page title.' },
      { key: 'seo_keywords', label: 'Global keywords', type: 'list' },
      { key: 'seo_og_image', label: 'Default OG image URL' },
      { key: 'seo_twitter_handle', label: 'Twitter/X handle' },
      { key: 'seo_robots', label: 'Robots directive' },
      { key: 'seo_google_verification', label: 'Google Search Console token' },
      { key: 'seo_bing_verification', label: 'Bing Webmaster token' },
      { key: 'seo_yandex_verification', label: 'Yandex verification token' },
      { key: 'seo_pinterest_verification', label: 'Pinterest verification token' },
      { key: 'seo_sitemap_enabled', label: 'Generate sitemap.xml', type: 'boolean' },
      {
        key: 'seo_noindex_site',
        label: 'No-index the entire site',
        type: 'boolean',
        hint: 'Emergency switch — blocks all search indexing.',
      },
    ],
  },
  {
    id: 'integrations',
    label: 'Analytics & ads',
    description: 'Google Analytics, Tag Manager, Meta Pixel, Google Ads and AdSense.',
    fields: [
      { key: 'analytics_ga4_id', label: 'Google Analytics 4 ID', placeholder: 'G-XXXXXXXXXX' },
      { key: 'analytics_gtm_id', label: 'Google Tag Manager ID', placeholder: 'GTM-XXXXXXX' },
      { key: 'analytics_meta_pixel_id', label: 'Meta (Facebook) Pixel ID' },
      { key: 'analytics_google_ads_id', label: 'Google Ads conversion ID', placeholder: 'AW-XXXXXXXXX' },
      { key: 'analytics_google_ads_label', label: 'Google Ads conversion label' },
      {
        key: 'analytics_adsense_client',
        label: 'AdSense publisher ID',
        placeholder: 'ca-pub-XXXXXXXXXXXXXXXX',
      },
      { key: 'analytics_adsense_enabled', label: 'Enable AdSense', type: 'boolean' },
      { key: 'analytics_adsense_auto_ads', label: 'AdSense auto ads', type: 'boolean' },
      { key: 'analytics_clarity_id', label: 'Microsoft Clarity ID' },
      { key: 'analytics_hotjar_id', label: 'Hotjar site ID' },
      { key: 'analytics_tiktok_pixel', label: 'TikTok Pixel ID' },
      { key: 'analytics_pinterest_tag', label: 'Pinterest Tag ID' },
      { key: 'analytics_linkedin_partner', label: 'LinkedIn Partner ID' },
      { key: 'cookie_banner_enabled', label: 'Show cookie consent banner', type: 'boolean' },
    ],
  },
  {
    id: 'social',
    label: 'Social profiles',
    description: 'Linked in the footer and in the Organization schema.',
    fields: [
      { key: 'social_twitter', label: 'X / Twitter URL', type: 'url' },
      { key: 'social_instagram', label: 'Instagram URL', type: 'url' },
      { key: 'social_facebook', label: 'Facebook URL', type: 'url' },
      { key: 'social_pinterest', label: 'Pinterest URL', type: 'url' },
      { key: 'social_linkedin', label: 'LinkedIn URL', type: 'url' },
      { key: 'social_tiktok', label: 'TikTok URL', type: 'url' },
      { key: 'social_youtube', label: 'YouTube URL', type: 'url' },
    ],
  },
  {
    id: 'billing',
    label: 'Billing',
    description: 'Tax, invoicing and currency behaviour.',
    fields: [
      { key: 'billing_tax_enabled', label: 'Collect tax / VAT', type: 'boolean' },
      { key: 'billing_tax_rate', label: 'Default tax rate (%)', type: 'number' },
      { key: 'billing_invoice_prefix', label: 'Invoice number prefix' },
      {
        key: 'billing_currency_lock',
        label: 'Lock currency after subscribing',
        type: 'boolean',
        hint: 'Prevents users switching currency once they have an active plan.',
      },
    ],
  },
];

export function SettingsEditor({ settings }: { settings: SettingsMap }) {
  const [active, setActive] = useState(GROUPS[0].id);
  const group = GROUPS.find((item) => item.id === active) ?? GROUPS[0];

  const booleanKeys = group.fields
    .filter((field) => field.type === 'boolean')
    .map((field) => field.key)
    .join(',');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Settings &amp; integrations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything here is stored in the database and applied without a redeploy.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {GROUPS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            onClick={() => setActive(item.id)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              active === item.id
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card hover:bg-secondary'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">{group.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>

        <AdminForm action={saveSettingsAction} className="mt-5" submitLabel="Save settings">
          <input type="hidden" name="__booleans" value={booleanKeys} />
          <div className="grid gap-5 sm:grid-cols-2">
            {group.fields.map((field) => (
              <SettingInput key={field.key} field={field} value={settings[field.key]} />
            ))}
          </div>
        </AdminForm>
      </Card>
    </div>
  );
}

function SettingInput({ field, value }: { field: SettingField; value: unknown }) {
  const name = `setting:${field.key}`;
  const type = field.type ?? 'text';

  if (type === 'boolean') {
    return (
      <label className="flex items-start gap-3 rounded-lg border border-border p-3 sm:col-span-2">
        <input
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={value === true}
          className="mt-0.5 h-4 w-4 rounded border-input text-primary"
        />
        <span>
          <span className="block text-sm font-medium">{field.label}</span>
          {field.hint && <span className="block text-xs text-muted-foreground">{field.hint}</span>}
        </span>
      </label>
    );
  }

  if (type === 'textarea') {
    return (
      <Field label={field.label} hint={field.hint} htmlFor={name} className="sm:col-span-2">
        <Textarea id={name} name={name} rows={3} defaultValue={stringify(value)} />
      </Field>
    );
  }

  if (type === 'list') {
    return (
      <Field
        label={field.label}
        hint={field.hint ?? 'Comma-separated.'}
        htmlFor={name}
        className="sm:col-span-2"
      >
        <Textarea
          id={name}
          name={name}
          rows={2}
          defaultValue={Array.isArray(value) ? JSON.stringify(value) : stringify(value)}
        />
      </Field>
    );
  }

  return (
    <Field label={field.label} hint={field.hint} htmlFor={name}>
      <Input
        id={name}
        name={name}
        type={type === 'number' ? 'number' : type === 'email' ? 'email' : 'text'}
        placeholder={field.placeholder}
        defaultValue={stringify(value)}
      />
    </Field>
  );
}

function stringify(value: unknown) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
