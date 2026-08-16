import type { Metadata } from 'next';
import { query, parseJson } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { PagesManager } from '@/components/admin/pages-manager';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'Pages', noIndex: true });
}

export default async function AdminPagesPage() {
  const pages = await query<any>(`SELECT * FROM pages ORDER BY sort_order ASC`);
  const rows = pages.map((page) => ({
    ...page,
    keywords: parseJson<string[]>(page.keywords, []),
  }));

  return <PagesManager pages={rows} />;
}
