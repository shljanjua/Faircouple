import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { buildMetadata } from '@/lib/seo';
import { BlogManager } from '@/components/admin/blog-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Blog', noIndex: true });
}

export default async function AdminBlogPage() {
  const supabase = createAdminClient();
  const [{ data: posts }, { data: categories }] = await Promise.all([
    supabase
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false, nullsFirst: false }),
    supabase.from('blog_categories').select('*').order('sort_order'),
  ]);

  return <BlogManager posts={(posts ?? []) as any[]} categories={(categories ?? []) as any[]} />;
}
