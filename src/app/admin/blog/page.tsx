import type { Metadata } from 'next';
import { query, parseJson } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { BlogManager } from '@/components/admin/blog-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Blog', noIndex: true });
}

export default async function AdminBlogPage() {
  const [posts, categories] = await Promise.all([
    query<any>(
      `SELECT * FROM blog_posts ORDER BY published_at IS NULL, published_at DESC, created_at DESC`
    ),
    query<any>(`SELECT * FROM blog_categories ORDER BY sort_order ASC`),
  ]);

  const rows = posts.map((post) => ({
    ...post,
    tags: parseJson<string[]>(post.tags, []),
    keywords: parseJson<string[]>(post.keywords, []),
  }));

  return <BlogManager posts={rows} categories={categories} />;
}
