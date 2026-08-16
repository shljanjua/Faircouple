import type { MetadataRoute } from 'next';
import { getPublicSettings } from '@/lib/settings';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getPublicSettings();
  const blocked = settings.seo_noindex_site === true || settings.maintenance_mode === true;

  if (blocked) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      sitemap: `${SITE_URL}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin',
          '/admin/*',
          '/dashboard',
          '/dashboard/*',
          '/api/*',
          '/checkout',
          '/onboarding',
          '/invite/*',
          '/join/*',
          '/reset-password',
          '/verify-email',
          '/auth/*',
          '/*?checkout=',
        ],
      },
      {
        // Give the major crawlers an explicit allow for the marketing surface.
        userAgent: ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Slurp', 'Applebot'],
        allow: ['/', '/blog/*', '/destinations/*', '/countries/*'],
        disallow: ['/admin', '/dashboard', '/api'],
      },
      { userAgent: 'GPTBot', disallow: '/dashboard' },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
