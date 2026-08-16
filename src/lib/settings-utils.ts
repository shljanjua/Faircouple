/**
 * Pure settings helpers — safe to import from client components.
 * The server-only loaders live in `@/lib/settings`.
 */

export type SettingsMap = Record<string, any>;

export const DEFAULT_SETTINGS: SettingsMap = {
  site_name: 'FairCouples',
  site_tagline: 'Fair love, measured.',
  site_description:
    'FairCouples is the relationship fairness platform for couples and families — track emotions, balance effort, split budgets fairly and plan trips together.',
  site_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://grey-opossum-178268.hostingersite.com',
  support_email: 'support@faircouples.com',
  company_name: 'FairCouples Ltd',
  company_address: '',
  default_currency: 'USD',
  supported_currencies: ['USD', 'GBP', 'EUR', 'CAD', 'AUD'],
  maintenance_mode: false,
  signup_enabled: true,
  require_email_verification: true,
  trial_days: 14,
  seo_default_title:
    'FairCouples — Relationship Fairness, Emotions, Budget & Travel Planner for Couples',
  seo_title_template: '%s | FairCouples',
  seo_keywords: [],
  seo_og_image: '/og',
  seo_twitter_handle: '@faircouples',
  seo_robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
  seo_noindex_site: false,
  seo_google_verification: '',
  seo_bing_verification: '',
  seo_yandex_verification: '',
  seo_pinterest_verification: '',
  analytics_ga4_id: '',
  analytics_gtm_id: '',
  analytics_meta_pixel_id: '',
  analytics_google_ads_id: '',
  analytics_google_ads_label: '',
  analytics_adsense_client: '',
  analytics_adsense_enabled: false,
  analytics_adsense_auto_ads: true,
  analytics_clarity_id: '',
  analytics_hotjar_id: '',
  analytics_tiktok_pixel: '',
  analytics_pinterest_tag: '',
  analytics_linkedin_partner: '',
  cookie_banner_enabled: true,
  social_twitter: '',
  social_instagram: '',
  social_facebook: '',
  social_pinterest: '',
  social_linkedin: '',
  social_tiktok: '',
  social_youtube: '',
  feature_ads_on_free: true,
  feature_blog_enabled: true,
  feature_referrals_enabled: true,
  billing_currency_lock: false,
};

export function settingString(settings: SettingsMap, key: string, fallback = ''): string {
  const value = settings[key];
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
}

export function settingBool(settings: SettingsMap, key: string, fallback = false): boolean {
  const value = settings[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

export function settingNumber(settings: SettingsMap, key: string, fallback = 0): number {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : fallback;
}
