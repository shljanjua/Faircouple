import type { Metadata } from 'next';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import Link from 'next/link';
import { getCmsPage, getRedirect } from '@/lib/queries';
import { buildMetadata, breadcrumbSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { formatDate, renderMarkdown } from '@/lib/utils';

export const revalidate = 3600;

const getPage = getCmsPage;

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const page = await getPage(params.slug);
  if (!page) return buildMetadata({ title: 'Page not found', noIndex: true });

  return buildMetadata({
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? undefined,
    path: `/${page.slug}`,
    keywords: page.keywords ?? [],
    noIndex: page.no_index,
  });
}

/**
 * Renders any CMS page (privacy policy, terms, cookies, refunds, GDPR,
 * acceptable use, disclaimer, about, or anything an admin creates).
 */
export default async function CmsPage({ params }: { params: { slug: string } }) {
  const page = await getPage(params.slug);

  if (!page) {
    // Fall back to the admin-managed redirect table before showing a 404.
    const rule = await getRedirect(`/${params.slug}`);

    if (rule) {
      if (rule.status_code === 302 || rule.status_code === 307) {
        redirect(rule.destination);
      }
      permanentRedirect(rule.destination);
    }

    notFound();
  }

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: page.title, path: `/${page.slug}` },
        ])}
      />

      <article className="py-12">
        <div className="container max-w-3xl">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <Link href="/" className="hover:text-primary">
              Home
            </Link>
            <span className="mx-2">/</span>
            <span>{page.title}</span>
          </nav>

          <h1 className="mt-4 font-display text-4xl font-bold">{page.title}</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated {formatDate(page.updated_at)}
          </p>

          <div
            className="prose-cms mt-8"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(page.content ?? '') }}
          />
        </div>
      </article>
    </>
  );
}
