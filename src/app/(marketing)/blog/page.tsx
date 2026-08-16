import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { buildMetadata, breadcrumbSchema, absoluteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { Badge, Card, SectionHeading } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export const revalidate = 600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Blog — fairness, emotions, money and couples travel',
    description:
      'Guides on relationship fairness, emotional communication, splitting money without resentment and planning trips as a couple.',
    path: '/blog',
    keywords: ['relationship blog', 'couples advice', 'fair relationship guides', 'couples travel blog'],
  });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const supabase = createClient();

  let query = supabase
    .from('blog_posts')
    .select('*, category:blog_categories(slug, name)')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  const { data: categories } = await supabase
    .from('blog_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (searchParams.category) {
    const category = ((categories ?? []) as any[]).find((c) => c.slug === searchParams.category);
    if (category) query = query.eq('category_id', category.id);
  }

  const { data: posts } = await query;
  const list = (posts ?? []) as any[];
  const featured = list.find((post) => post.is_featured) ?? list[0];
  const rest = list.filter((post) => post.id !== featured?.id);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'Blog',
            name: 'FairCouples Blog',
            url: absoluteUrl('/blog'),
            blogPost: list.slice(0, 10).map((post) => ({
              '@type': 'BlogPosting',
              headline: post.title,
              url: absoluteUrl(`/blog/${post.slug}`),
              datePublished: post.published_at,
              description: post.excerpt,
            })),
          },
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-14">
        <div className="container">
          <SectionHeading
            eyebrow="Blog"
            title="Read before your next conversation"
            description="Fairness, emotions, money and travel — written for two people who want the relationship to work, not just feel good."
          />
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <Link
              href="/blog"
              className={cn(
                'rounded-full border px-4 py-1.5 text-sm',
                !searchParams.category
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card hover:bg-secondary'
              )}
            >
              All
            </Link>
            {((categories ?? []) as any[]).map((category) => (
              <Link
                key={category.slug}
                href={`/blog?category=${category.slug}`}
                className={cn(
                  'rounded-full border px-4 py-1.5 text-sm',
                  searchParams.category === category.slug
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card hover:bg-secondary'
                )}
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12">
        <div className="container">
          {featured && (
            <Link href={`/blog/${featured.slug}`} className="group block">
              <Card className="overflow-hidden p-8 transition-all hover:shadow-md sm:p-10">
                <Badge tone="primary">Featured</Badge>
                <h2 className="mt-4 max-w-3xl text-3xl font-bold group-hover:text-primary sm:text-4xl">
                  {featured.title}
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">{featured.excerpt}</p>
                <p className="mt-5 text-sm text-muted-foreground">
                  {featured.category?.name} · {featured.reading_minutes} min read ·{' '}
                  {formatDate(featured.published_at)}
                </p>
              </Card>
            </Link>
          )}

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((post) => (
              <Link key={post.id} href={`/blog/${post.slug}`} className="group">
                <Card className="flex h-full flex-col p-6 transition-all hover:-translate-y-0.5 hover:shadow-md">
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">
                    {post.category?.name ?? 'Guide'}
                  </p>
                  <h2 className="mt-2 font-semibold group-hover:text-primary">{post.title}</h2>
                  <p className="mt-2 flex-1 line-clamp-3 text-sm text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {post.reading_minutes} min read · {formatDate(post.published_at)}
                  </p>
                </Card>
              </Link>
            ))}
          </div>

          {list.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground">
              No posts published yet.
            </Card>
          )}
        </div>
      </section>
    </>
  );
}
