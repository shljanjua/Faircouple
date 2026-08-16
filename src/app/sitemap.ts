import type { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 3600;

const STATIC_ROUTES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' },
  { path: '/features', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/pricing', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/fairness', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/love-or-attraction', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/destinations', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/checklists', priority: 0.8, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.8, changeFrequency: 'daily' },
  { path: '/faq', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/signup', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/signin', priority: 0.4, changeFrequency: 'monthly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  try {
    const supabase = createClient();
    const [{ data: posts }, { data: pages }, { data: destinations }, { data: countries }] =
      await Promise.all([
        supabase
          .from('blog_posts')
          .select('slug, updated_at, published_at')
          .eq('status', 'published')
          .eq('no_index', false),
        supabase
          .from('pages')
          .select('slug, updated_at, no_index')
          .eq('status', 'published'),
        supabase
          .from('destinations')
          .select('slug, updated_at')
          .eq('is_active', true),
        supabase.from('countries').select('slug').eq('is_active', true),
      ]);

    for (const post of (posts ?? []) as any[]) {
      entries.push({
        url: `${SITE_URL}/blog/${post.slug}`,
        lastModified: new Date(post.updated_at ?? post.published_at ?? now),
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }

    for (const page of (pages ?? []) as any[]) {
      if (page.no_index) continue;
      entries.push({
        url: `${SITE_URL}/${page.slug}`,
        lastModified: new Date(page.updated_at ?? now),
        changeFrequency: 'yearly',
        priority: 0.4,
      });
    }

    for (const destination of (destinations ?? []) as any[]) {
      entries.push({
        url: `${SITE_URL}/destinations/${destination.slug}`,
        lastModified: new Date(destination.updated_at ?? now),
        changeFrequency: 'monthly',
        priority: 0.8,
      });
    }

    for (const country of (countries ?? []) as any[]) {
      entries.push({
        url: `${SITE_URL}/countries/${country.slug}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.7,
      });
    }
  } catch {
    // Database unavailable — still return the static routes.
  }

  return entries;
}
