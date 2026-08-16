import type { Metadata } from 'next';
import { query, parseJson } from '@/lib/db';
import { buildMetadata, SITE_URL } from '@/lib/seo';
import { deleteRedirectAction, saveRedirectAction, saveSeoMetaAction } from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Alert, Badge, Card, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'SEO', noIndex: true });
}

export default async function AdminSeoPage() {
  const [metaRows, redirects, counts] = await Promise.all([
    query<any>(`SELECT * FROM seo_meta ORDER BY path ASC`),
    query<any>(`SELECT * FROM redirects ORDER BY created_at DESC`),
    query<{ metric: string; total: number }>(
      `SELECT 'posts' AS metric, COUNT(*) AS total FROM blog_posts WHERE status = 'published'
       UNION ALL SELECT 'destinations', COUNT(*) FROM destinations WHERE is_active = 1`
    ),
  ]);

  const metas = metaRows.map((meta) => ({
    ...meta,
    keywords: parseJson<string[]>(meta.keywords, []),
  }));

  const countOf = (metric: string) =>
    Number(counts.find((row) => row.metric === metric)?.total ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">SEO</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-route metadata, redirects and the technical files search engines read.
        </p>
      </header>

      <Alert tone="info" title="Technical SEO is live">
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            Sitemap index: <code>{SITE_URL}/sitemap.xml</code> — includes pages, blog posts (
            {countOf('posts')}), destinations ({countOf('destinations')}) and countries.
          </li>
          <li>
            Robots: <code>{SITE_URL}/robots.txt</code> — blocks /admin, /dashboard and /api.
          </li>
          <li>
            Structured data: Organization, WebSite, SoftwareApplication, BreadcrumbList, FAQPage,
            BlogPosting, TouristDestination and Product schemas are emitted automatically.
          </li>
          <li>Canonical URLs, OpenGraph and Twitter cards are generated on every page.</li>
        </ul>
      </Alert>

      <Card className="p-5">
        <h2 className="font-semibold">Per-route metadata</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Overrides the defaults for a specific path — useful for landing pages you are actively
          ranking.
        </p>
        <AdminForm action={saveSeoMetaAction} className="mt-4" submitLabel="Save metadata">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Path" required htmlFor="path" hint="e.g. /destinations/santorini">
              <Input id="path" name="path" required placeholder="/" />
            </Field>
            <Field label="Canonical URL" htmlFor="canonical_url">
              <Input id="canonical_url" name="canonical_url" />
            </Field>
            <Field label="Title" htmlFor="title" className="sm:col-span-2">
              <Input id="title" name="title" />
            </Field>
            <Field label="Description" htmlFor="description" className="sm:col-span-2">
              <Textarea id="description" name="description" rows={2} />
            </Field>
            <Field label="Keywords" hint="Comma-separated." htmlFor="keywords" className="sm:col-span-2">
              <Input id="keywords" name="keywords" />
            </Field>
            <Field label="OG image" htmlFor="og_image">
              <Input id="og_image" name="og_image" />
            </Field>
            <Field label="Robots" htmlFor="robots">
              <Select id="robots" name="robots" defaultValue="index,follow">
                <option value="index,follow">index, follow</option>
                <option value="noindex,follow">noindex, follow</option>
                <option value="index,nofollow">index, nofollow</option>
                <option value="noindex,nofollow">noindex, nofollow</option>
              </Select>
            </Field>
            <Field label="Sitemap priority" htmlFor="priority">
              <Input id="priority" name="priority" type="number" step="0.1" min="0" max="1" defaultValue={0.7} />
            </Field>
            <Field label="Change frequency" htmlFor="changefreq">
              <Select id="changefreq" name="changefreq" defaultValue="weekly">
                {['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </AdminForm>

        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>Path</Th>
                <Th>Title</Th>
                <Th>Robots</Th>
                <Th>Priority</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {metas.map((meta) => (
                <tr key={meta.id}>
                  <Td className="font-mono text-xs">{meta.path}</Td>
                  <Td className="max-w-md truncate">{meta.title ?? '—'}</Td>
                  <Td>
                    <Badge tone={meta.robots?.includes('noindex') ? 'warning' : 'success'}>
                      {meta.robots}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">{meta.priority}</Td>
                  <Td className="text-muted-foreground">{formatDate(meta.updated_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Redirects</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          301s preserve link equity when you rename a page. Applied by the middleware on every
          request.
        </p>
        <AdminForm action={saveRedirectAction} className="mt-4" submitLabel="Save redirect" resetOnSuccess>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="From" required htmlFor="source">
              <Input id="source" name="source" required placeholder="/old-url" />
            </Field>
            <Field label="To" required htmlFor="destination">
              <Input id="destination" name="destination" required placeholder="/new-url" />
            </Field>
            <Field label="Status code" htmlFor="status_code">
              <Select id="status_code" name="status_code" defaultValue="301">
                <option value="301">301 permanent</option>
                <option value="302">302 temporary</option>
                <option value="307">307 temporary (preserve method)</option>
                <option value="308">308 permanent (preserve method)</option>
              </Select>
            </Field>
          </div>
        </AdminForm>

        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Code</Th>
                <Th>Hits</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {redirects.map((redirect) => (
                <tr key={redirect.id}>
                  <Td className="font-mono text-xs">{redirect.source}</Td>
                  <Td className="font-mono text-xs">{redirect.destination}</Td>
                  <Td>{redirect.status_code}</Td>
                  <Td className="text-muted-foreground">{redirect.hits}</Td>
                  <Td className="text-right">
                    <ActionButton
                      label="Remove"
                      variant="ghost"
                      action={() => deleteRedirectAction(redirect.id)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
