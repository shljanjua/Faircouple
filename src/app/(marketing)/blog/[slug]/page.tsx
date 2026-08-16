import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug, getPublishedPosts } from '@/lib/queries';
import { execute } from '@/lib/db';
import { buildMetadata, breadcrumbSchema, articleSchema, absoluteUrl } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { Card } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';
import { formatDate, renderMarkdown } from '@/lib/utils';

export const revalidate = 600;

const getPost = getPostBySlug;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return buildMetadata({ title: 'Post not found', noIndex: true });

  return buildMetadata({
    title: post.meta_title ?? post.title,
    description: post.meta_description ?? post.excerpt ?? undefined,
    path: `/blog/${post.slug}`,
    image: post.og_image ?? post.cover_image ?? undefined,
    type: 'article',
    publishedTime: post.published_at,
    modifiedTime: post.updated_at,
    authors: [post.author_name ?? 'FairCouples'],
    keywords: post.keywords ?? [],
    canonical: post.canonical_url ?? undefined,
    noIndex: post.no_index,
  });
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const related = (await getPublishedPosts({ limit: 4 }))
    .filter((item) => item.id !== post.id)
    .slice(0, 3);

  // Fire-and-forget view counter; never blocks rendering.
  void execute(`UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?`, [post.id]);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Blog', path: '/blog' },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          articleSchema({
            title: post.title,
            description: post.meta_description ?? post.excerpt ?? '',
            slug: post.slug,
            image: post.og_image ?? post.cover_image,
            publishedAt: post.published_at,
            updatedAt: post.updated_at,
            author: post.author_name,
            keywords: post.keywords,
          }),
        ]}
      />

      <article className="py-12">
        <div className="container max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/blog" className="hover:text-primary">
              Blog
            </Link>
            {post.category && (
              <>
                <span className="mx-2">/</span>
                <Link href={`/blog?category=${post.category.slug}`} className="hover:text-primary">
                  {post.category.name}
                </Link>
              </>
            )}
          </nav>

          <h1 className="mt-4 font-display text-4xl font-bold leading-tight sm:text-5xl">
            {post.title}
          </h1>

          <p className="mt-4 text-lg text-muted-foreground">{post.excerpt}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3 border-y border-border py-4 text-sm text-muted-foreground">
            <span>{post.author_name ?? 'FairCouples Team'}</span>
            <span aria-hidden>·</span>
            <time dateTime={post.published_at}>{formatDate(post.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{post.reading_minutes} min read</span>
          </div>

          {post.cover_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${post.cover_image}?auto=format&fit=crop&w=1200&q=75`}
              alt={post.title}
              className="mt-8 w-full rounded-xl object-cover"
            />
          )}

          <div
            className="prose-cms mt-8"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content ?? '') }}
          />

          {post.tags?.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          <Card className="mt-12 bg-gradient-to-br from-rose-500/10 to-fuchsia-500/10 p-6 text-center">
            <h2 className="text-xl font-bold">Measure it instead of arguing about it</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              Both partners score the same ten areas independently. FairCouples compares the two
              sides and shows exactly where effort is drifting apart.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href="/signup">Start free</ButtonLink>
              <ButtonLink href="/fairness" variant="outline">
                Read the framework
              </ButtonLink>
            </div>
          </Card>

          {related && related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-xl font-bold">Keep reading</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {related.map((item) => (
                  <Link key={item.slug} href={`/blog/${item.slug}`} className="group">
                    <Card className="h-full p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <h3 className="text-sm font-semibold group-hover:text-primary">
                        {item.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                        {item.excerpt}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <p className="mt-10 text-center text-xs text-muted-foreground">
            Share this article:{' '}
            <a
              href={`https://x.com/intent/tweet?url=${encodeURIComponent(absoluteUrl(`/blog/${post.slug}`))}&text=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              X
            </a>
            {' · '}
            <a
              href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(absoluteUrl(`/blog/${post.slug}`))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Facebook
            </a>
            {' · '}
            <a
              href={`https://pinterest.com/pin/create/button/?url=${encodeURIComponent(absoluteUrl(`/blog/${post.slug}`))}&description=${encodeURIComponent(post.title)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              Pinterest
            </a>
          </p>
        </div>
      </article>
    </>
  );
}
