import 'server-only';
import { query, queryOne, parseJson, toBool } from '@/lib/db';
import type { FairnessCategory, Plan, PlanPrice } from '@/types';

/**
 * Shared read queries. MySQL has no row-level security, so anything scoped to
 * a couple takes the couple id as an explicit argument and the caller must
 * have verified membership first (see `assertCoupleMember`).
 */

/* ------------------------------------------------------------------- Plans */

export async function getActivePlans(includeInactive = false): Promise<(Plan & { prices: PlanPrice[] })[]> {
  const plans = await query<any>(
    `SELECT * FROM plans ${includeInactive ? '' : 'WHERE is_active = 1'} ORDER BY sort_order ASC`
  );
  if (!plans.length) return [];

  const prices = await query<any>(
    `SELECT * FROM plan_prices WHERE plan_id IN (${plans.map(() => '?').join(',')}) AND is_active = 1`,
    plans.map((plan) => plan.id)
  );

  return plans.map((plan) => ({
    ...plan,
    is_active: toBool(plan.is_active),
    is_featured: toBool(plan.is_featured),
    is_free: toBool(plan.is_free),
    features: parseJson<string[]>(plan.features, []),
    limits: parseJson(plan.limits, {}),
    prices: prices
      .filter((price) => price.plan_id === plan.id)
      .map((price) => ({
        ...price,
        interval: price.billing_interval,
        is_active: toBool(price.is_active),
      })),
  })) as any;
}

export async function getPlanBySlug(slug: string) {
  const plan = await queryOne<any>(`SELECT * FROM plans WHERE slug = ? AND is_active = 1 LIMIT 1`, [
    slug,
  ]);
  if (!plan) return null;

  const prices = await query<any>(
    `SELECT * FROM plan_prices WHERE plan_id = ? AND is_active = 1`,
    [plan.id]
  );

  return {
    ...plan,
    is_free: toBool(plan.is_free),
    is_featured: toBool(plan.is_featured),
    features: parseJson<string[]>(plan.features, []),
    limits: parseJson(plan.limits, {}),
    prices: prices.map((price) => ({
      ...price,
      interval: price.billing_interval,
      is_active: toBool(price.is_active),
    })),
  };
}

/* --------------------------------------------------------------- Fairness */

export async function getFairnessCategories(): Promise<FairnessCategory[]> {
  const categories = await query<any>(
    `SELECT * FROM fairness_categories WHERE is_active = 1 ORDER BY sort_order ASC`
  );
  if (!categories.length) return [];

  const criteria = await query<any>(
    `SELECT * FROM fairness_criteria WHERE is_active = 1 ORDER BY sort_order ASC`
  );

  return categories.map((category) => ({
    ...category,
    weight: Number(category.weight ?? 1),
    is_active: toBool(category.is_active),
    is_dealbreaker: toBool(category.is_dealbreaker),
    criteria: criteria.filter((item) => item.category_id === category.id),
  }));
}

/* -------------------------------------------------------------------- CMS */

export async function getFooterPages() {
  return query<{ slug: string; title: string }>(
    `SELECT slug, title FROM pages
      WHERE status = 'published' AND show_in_footer = 1 AND page_type = 'legal'
      ORDER BY sort_order ASC`
  );
}

export async function getFaqs(filters: { category?: string; pagePath?: string; limit?: number } = {}) {
  const clauses = ['is_active = 1'];
  const params: any[] = [];

  if (filters.category) {
    clauses.push('category = ?');
    params.push(filters.category);
  }
  if (filters.pagePath) {
    clauses.push('page_path = ?');
    params.push(filters.pagePath);
  }

  return query<any>(
    `SELECT * FROM faqs WHERE ${clauses.join(' AND ')} ORDER BY sort_order ASC
     ${filters.limit ? `LIMIT ${Number(filters.limit)}` : ''}`,
    params
  );
}

export async function getTestimonials(limit = 6) {
  return query<any>(
    `SELECT * FROM testimonials WHERE is_active = 1 ORDER BY sort_order ASC LIMIT ${Number(limit)}`
  );
}

export async function getPublishedPosts(filters: { categorySlug?: string; limit?: number } = {}) {
  const clauses = ["b.status = 'published'"];
  const params: any[] = [];

  if (filters.categorySlug) {
    clauses.push('c.slug = ?');
    params.push(filters.categorySlug);
  }

  const rows = await query<any>(
    `SELECT b.*, c.slug AS category_slug, c.name AS category_name
       FROM blog_posts b
       LEFT JOIN blog_categories c ON c.id = b.category_id
      WHERE ${clauses.join(' AND ')}
      ORDER BY b.published_at DESC
      ${filters.limit ? `LIMIT ${Number(filters.limit)}` : ''}`,
    params
  );

  return rows.map(mapPost);
}

export function mapPost(row: any) {
  return {
    ...row,
    is_featured: toBool(row.is_featured),
    no_index: toBool(row.no_index),
    tags: parseJson<string[]>(row.tags, []),
    keywords: parseJson<string[]>(row.keywords, []),
    category: row.category_slug ? { slug: row.category_slug, name: row.category_name } : null,
  };
}

export async function getPostBySlug(slug: string) {
  const row = await queryOne<any>(
    `SELECT b.*, c.slug AS category_slug, c.name AS category_name
       FROM blog_posts b
       LEFT JOIN blog_categories c ON c.id = b.category_id
      WHERE b.slug = ? AND b.status = 'published'
      LIMIT 1`,
    [slug]
  );
  return row ? mapPost(row) : null;
}

export async function getCmsPage(slug: string) {
  const row = await queryOne<any>(
    `SELECT * FROM pages WHERE slug = ? AND status = 'published' LIMIT 1`,
    [slug]
  );
  if (!row) return null;
  return { ...row, no_index: toBool(row.no_index), keywords: parseJson<string[]>(row.keywords, []) };
}

/* ----------------------------------------------------------------- Travel */

export function mapDestination(row: any) {
  return {
    ...row,
    is_honeymoon: toBool(row.is_honeymoon),
    is_featured: toBool(row.is_featured),
    is_active: toBool(row.is_active),
    best_months: parseJson<string[]>(row.best_months, []),
    tags: parseJson<string[]>(row.tags, []),
    highlights: parseJson<string[]>(row.highlights, []),
    gallery: parseJson<string[]>(row.gallery, []),
    keywords: parseJson<string[]>(row.keywords, []),
    country: row.country_name
      ? {
          name: row.country_name,
          slug: row.country_slug,
          flag_emoji: row.country_flag,
          region: row.country_region,
          currency_code: row.country_currency,
          best_season: row.country_season,
          is_schengen: toBool(row.country_schengen),
        }
      : undefined,
  };
}

const DESTINATION_SELECT = `
  d.*, c.name AS country_name, c.slug AS country_slug, c.flag_emoji AS country_flag,
  c.region AS country_region, c.currency_code AS country_currency,
  c.best_season AS country_season, c.is_schengen AS country_schengen
`;

export async function getDestinations(filters: {
  type?: string;
  budget?: string;
  search?: string;
  countryCode?: string;
  honeymoonOnly?: boolean;
  featuredOnly?: boolean;
  limit?: number;
} = {}) {
  const clauses = ['d.is_active = 1'];
  const params: any[] = [];

  if (filters.honeymoonOnly) clauses.push('d.is_honeymoon = 1');
  if (filters.featuredOnly) clauses.push('d.is_featured = 1');
  if (filters.type) {
    clauses.push('d.destination_type = ?');
    params.push(filters.type);
  }
  if (filters.budget) {
    clauses.push('d.budget_level = ?');
    params.push(filters.budget);
  }
  if (filters.countryCode) {
    clauses.push('d.country_code = ?');
    params.push(filters.countryCode);
  }
  if (filters.search) {
    clauses.push('d.name LIKE ?');
    params.push(`%${filters.search}%`);
  }

  const rows = await query<any>(
    `SELECT ${DESTINATION_SELECT}
       FROM destinations d
       LEFT JOIN countries c ON c.code = d.country_code
      WHERE ${clauses.join(' AND ')}
      ORDER BY d.popularity DESC
      LIMIT ${Number(filters.limit ?? 120)}`,
    params
  );

  return rows.map(mapDestination);
}

export async function getDestinationBySlug(slug: string) {
  const row = await queryOne<any>(
    `SELECT ${DESTINATION_SELECT}
       FROM destinations d
       LEFT JOIN countries c ON c.code = d.country_code
      WHERE d.slug = ? AND d.is_active = 1
      LIMIT 1`,
    [slug]
  );
  if (!row) return null;

  const attractions = await query<any>(
    `SELECT * FROM attractions WHERE destination_id = ? ORDER BY sort_order ASC`,
    [row.id]
  );

  return {
    ...mapDestination(row),
    attractions: attractions.map((attraction) => ({
      ...attraction,
      is_must_see: toBool(attraction.is_must_see),
      is_romantic: toBool(attraction.is_romantic),
    })),
  };
}

export async function getCountries(activeOnly = true) {
  const rows = await query<any>(
    `SELECT * FROM countries ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY sort_order ASC, name ASC`
  );
  return rows.map((row) => ({
    ...row,
    is_schengen: toBool(row.is_schengen),
    is_tier1: toBool(row.is_tier1),
    is_featured: toBool(row.is_featured),
    languages: parseJson<string[]>(row.languages, []),
  }));
}

export async function getCountryBySlug(slug: string) {
  const row = await queryOne<any>(
    `SELECT * FROM countries WHERE slug = ? AND is_active = 1 LIMIT 1`,
    [slug]
  );
  if (!row) return null;
  return {
    ...row,
    is_schengen: toBool(row.is_schengen),
    is_tier1: toBool(row.is_tier1),
    languages: parseJson<string[]>(row.languages, []),
  };
}

export async function getChecklistTemplates(categories?: string[]) {
  const rows = await query<any>(
    `SELECT * FROM checklist_templates
      WHERE is_public = 1
      ${categories?.length ? `AND category IN (${categories.map(() => '?').join(',')})` : ''}
      ORDER BY sort_order ASC`,
    categories ?? []
  );
  return rows.map((row) => ({
    ...row,
    is_premium: toBool(row.is_premium),
    items: parseJson<any[]>(row.items, []),
  }));
}

/* ---------------------------------------------------------------- Lookups */

export async function getRedirect(source: string) {
  return queryOne<{ destination: string; status_code: number }>(
    `SELECT destination, status_code FROM redirects WHERE source = ? AND is_active = 1 LIMIT 1`,
    [source]
  );
}

export async function getEmotionTypes() {
  return query<any>(`SELECT * FROM emotion_types WHERE is_active = 1 ORDER BY sort_order ASC`);
}
