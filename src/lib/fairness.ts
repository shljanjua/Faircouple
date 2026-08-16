import type { FairnessCategory, FairnessEntry } from '@/types';

export type RiskLevel = 'healthy' | 'watch' | 'strained' | 'critical';

export interface MemberScores {
  userId: string;
  name: string;
  effort: number;
  selfScore: number;
  partnerScore: number;
  respect: number;
  loyalty: number;
  satisfaction: number;
  entries: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  slug: string;
  name: string;
  emoji: string | null;
  fairRule: string;
  weight: number;
  isDealbreaker: boolean;
  a: { self: number | null; partner: number | null; effort: number | null };
  b: { self: number | null; partner: number | null; effort: number | null };
  gap: number;
  agreement: number | null;
  score: number | null;
  status: 'balanced' | 'tilted_a' | 'tilted_b' | 'missing';
}

export interface FairnessReport {
  period: string;
  overallScore: number;
  balanceIndex: number;
  effortA: number;
  effortB: number;
  respectDelta: number;
  loyaltyDelta: number;
  riskLevel: RiskLevel;
  verdict: string;
  completeness: number;
  categories: CategoryBreakdown[];
  insights: Insight[];
  memberA: MemberScores;
  memberB: MemberScores;
}

export interface Insight {
  tone: 'positive' | 'neutral' | 'warning' | 'critical';
  title: string;
  detail: string;
  categorySlug?: string;
}

const round = (n: number, dp = 1) => Math.round(n * 10 ** dp) / 10 ** dp;
const avg = (values: number[]) =>
  values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;

/** Effort on a 0–100 scale: use effort_self when present, else self_score × 10. */
function effortOf(entry: FairnessEntry): number | null {
  if (entry.effort_self !== null && entry.effort_self !== undefined) return entry.effort_self;
  if (entry.self_score !== null && entry.self_score !== undefined) return entry.self_score * 10;
  return null;
}

export function buildReport(params: {
  period: string;
  categories: FairnessCategory[];
  entries: FairnessEntry[];
  memberA: { userId: string; name: string };
  memberB: { userId: string; name: string } | null;
}): FairnessReport {
  const { period, categories, entries, memberA, memberB } = params;

  const entriesA = entries.filter((e) => e.user_id === memberA.userId);
  const entriesB = memberB ? entries.filter((e) => e.user_id === memberB.userId) : [];

  const scoresFor = (list: FairnessEntry[], meta: { userId: string; name: string }): MemberScores => ({
    userId: meta.userId,
    name: meta.name,
    effort: round(avg(list.map(effortOf).filter((v): v is number => v !== null))),
    selfScore: round(avg(list.map((e) => e.self_score ?? 0).filter((v) => v > 0))),
    partnerScore: round(avg(list.map((e) => e.partner_score ?? 0).filter((v) => v > 0))),
    respect: round(avg(list.map((e) => e.respect_score ?? 0).filter((v) => v > 0))),
    loyalty: round(avg(list.map((e) => e.loyalty_score ?? 0).filter((v) => v > 0))),
    satisfaction: round(avg(list.map((e) => e.satisfaction ?? 0).filter((v) => v > 0))),
    entries: list.length,
  });

  const a = scoresFor(entriesA, memberA);
  const b = scoresFor(entriesB, memberB ?? { userId: '', name: 'Partner B' });

  const breakdown: CategoryBreakdown[] = categories.map((category) => {
    const ea = entriesA.find((e) => e.category_id === category.id);
    const eb = entriesB.find((e) => e.category_id === category.id);

    const effA = ea ? effortOf(ea) : null;
    const effB = eb ? effortOf(eb) : null;

    // "Agreement" compares how I rated myself against how my partner rated me.
    const agreementValues: number[] = [];
    if (ea?.self_score != null && eb?.partner_score != null) {
      agreementValues.push(10 - Math.abs(ea.self_score - eb.partner_score));
    }
    if (eb?.self_score != null && ea?.partner_score != null) {
      agreementValues.push(10 - Math.abs(eb.self_score - ea.partner_score));
    }

    const scoreValues = [
      ea?.self_score,
      ea?.partner_score,
      eb?.self_score,
      eb?.partner_score,
    ].filter((v): v is number => typeof v === 'number');

    const gap = effA !== null && effB !== null ? Math.abs(effA - effB) : 0;

    let status: CategoryBreakdown['status'] = 'missing';
    if (effA !== null && effB !== null) {
      if (gap <= 15) status = 'balanced';
      else status = effA > effB ? 'tilted_a' : 'tilted_b';
    }

    return {
      categoryId: category.id,
      slug: category.slug,
      name: category.name,
      emoji: category.emoji,
      fairRule: category.fair_rule,
      weight: Number(category.weight ?? 1),
      isDealbreaker: category.is_dealbreaker,
      a: { self: ea?.self_score ?? null, partner: ea?.partner_score ?? null, effort: effA },
      b: { self: eb?.self_score ?? null, partner: eb?.partner_score ?? null, effort: effB },
      gap: round(gap),
      agreement: agreementValues.length ? round(avg(agreementValues) * 10) : null,
      score: scoreValues.length ? round(avg(scoreValues) * 10) : null,
      status,
    };
  });

  // Weighted overall score across categories that have any data.
  const scored = breakdown.filter((c) => c.score !== null);
  const weightSum = scored.reduce((sum, c) => sum + c.weight, 0);
  const overallScore = weightSum
    ? round(scored.reduce((sum, c) => sum + (c.score ?? 0) * c.weight, 0) / weightSum)
    : 0;

  const totalEffort = a.effort + b.effort;
  const balanceIndex = totalEffort
    ? round(Math.max(0, 100 - (Math.abs(a.effort - b.effort) / totalEffort) * 200))
    : 0;

  const expectedEntries = categories.length * (memberB ? 2 : 1);
  const completeness = expectedEntries
    ? Math.round(((entriesA.length + entriesB.length) / expectedEntries) * 100)
    : 0;

  const respectDelta = round(Math.abs(a.respect - b.respect));
  const loyaltyDelta = round(Math.abs(a.loyalty - b.loyalty));

  const riskLevel = deriveRisk({ overallScore, balanceIndex, breakdown, completeness });
  const verdict = deriveVerdict({ riskLevel, balanceIndex, overallScore, a, b, completeness });
  const insights = deriveInsights({ breakdown, a, b, balanceIndex, respectDelta, loyaltyDelta, completeness });

  return {
    period,
    overallScore,
    balanceIndex,
    effortA: a.effort,
    effortB: b.effort,
    respectDelta,
    loyaltyDelta,
    riskLevel,
    verdict,
    completeness,
    categories: breakdown,
    insights,
    memberA: a,
    memberB: b,
  };
}

function deriveRisk(params: {
  overallScore: number;
  balanceIndex: number;
  breakdown: CategoryBreakdown[];
  completeness: number;
}): RiskLevel {
  const { overallScore, balanceIndex, breakdown, completeness } = params;
  if (completeness < 20) return 'watch';

  const dealbreaker = breakdown.find((c) => c.isDealbreaker && c.score !== null);
  if (dealbreaker && dealbreaker.score !== null && dealbreaker.score < 60) return 'critical';

  if (balanceIndex >= 80 && overallScore >= 70) return 'healthy';
  if (balanceIndex >= 60 && overallScore >= 55) return 'watch';
  if (balanceIndex >= 40 || overallScore >= 40) return 'strained';
  return 'critical';
}

function deriveVerdict(params: {
  riskLevel: RiskLevel;
  balanceIndex: number;
  overallScore: number;
  a: MemberScores;
  b: MemberScores;
  completeness: number;
}) {
  const { riskLevel, balanceIndex, a, b, completeness } = params;
  if (completeness < 20) {
    return 'Not enough entries yet. Both partners need to complete their side before the report means anything.';
  }
  const heavier = a.effort > b.effort ? a.name : b.name;
  const lighter = a.effort > b.effort ? b.name : a.name;

  switch (riskLevel) {
    case 'healthy':
      return `Effort is balanced (${balanceIndex}/100) and both of you are scoring the relationship consistently. Keep the weekly ritual — this is what stable looks like.`;
    case 'watch':
      return `Mostly balanced, but ${heavier} is carrying slightly more than ${lighter} this period. One conversation now prevents a pattern later.`;
    case 'strained':
      return `Effort is meaningfully one-sided: ${heavier} is doing noticeably more than ${lighter}. Over time this is the pattern that turns into resentment.`;
    case 'critical':
      return `This period shows a serious imbalance or a deal-breaker score. Address it directly — and if abuse, manipulation or repeated dishonesty is involved, seek outside support.`;
  }
}

function deriveInsights(params: {
  breakdown: CategoryBreakdown[];
  a: MemberScores;
  b: MemberScores;
  balanceIndex: number;
  respectDelta: number;
  loyaltyDelta: number;
  completeness: number;
}): Insight[] {
  const { breakdown, a, b, balanceIndex, respectDelta, loyaltyDelta, completeness } = params;
  const insights: Insight[] = [];

  if (completeness < 100) {
    insights.push({
      tone: completeness < 50 ? 'warning' : 'neutral',
      title: `${completeness}% of entries completed`,
      detail:
        'A fairness report only works when both partners answer independently. Missing categories are excluded from the score.',
    });
  }

  if (balanceIndex >= 85) {
    insights.push({
      tone: 'positive',
      title: 'Effort is close to even',
      detail: `${a.name} and ${b.name} are within ${Math.abs(a.effort - b.effort).toFixed(0)} points of each other. That is what a fair week looks like.`,
    });
  }

  const tilted = breakdown
    .filter((c) => c.status === 'tilted_a' || c.status === 'tilted_b')
    .sort((x, y) => y.gap - x.gap)
    .slice(0, 3);

  for (const category of tilted) {
    const heavier = category.status === 'tilted_a' ? a.name : b.name;
    const lighter = category.status === 'tilted_a' ? b.name : a.name;
    insights.push({
      tone: category.gap > 35 ? 'warning' : 'neutral',
      title: `${category.emoji ?? ''} ${category.name}: ${category.gap.toFixed(0)}-point gap`,
      detail: `${heavier} is putting in more here than ${lighter}. Fair rule: ${category.fairRule}`,
      categorySlug: category.slug,
    });
  }

  const disagreements = breakdown
    .filter((c) => c.agreement !== null && c.agreement < 60)
    .sort((x, y) => (x.agreement ?? 0) - (y.agreement ?? 0))
    .slice(0, 2);

  for (const category of disagreements) {
    insights.push({
      tone: 'warning',
      title: `You see ${category.name} differently`,
      detail:
        'One of you rated this far higher than the other rated them. That gap in perception is usually the real argument.',
      categorySlug: category.slug,
    });
  }

  if (respectDelta >= 3) {
    insights.push({
      tone: 'warning',
      title: 'Respect is not symmetrical',
      detail: `Respect scores differ by ${respectDelta.toFixed(1)} points. Fair rule: freedom and respect should be equal — not one controlling the other.`,
    });
  }

  if (loyaltyDelta >= 3) {
    insights.push({
      tone: 'critical',
      title: 'Loyalty scores diverge',
      detail:
        'Trust is built by both and broken by one, but it affects both. Talk about what changed before it compounds.',
    });
  }

  const dealbreaker = breakdown.find((c) => c.isDealbreaker && c.score !== null && c.score < 70);
  if (dealbreaker) {
    insights.push({
      tone: 'critical',
      title: 'Deal breaker flagged',
      detail:
        'Abuse, manipulation and repeated dishonesty are non-negotiable and apply equally to both partners. If you are in danger, contact your local emergency service.',
      categorySlug: dealbreaker.slug,
    });
  }

  const strongest = breakdown
    .filter((c) => c.score !== null)
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0))[0];
  if (strongest && (strongest.score ?? 0) >= 80) {
    insights.push({
      tone: 'positive',
      title: `${strongest.emoji ?? ''} ${strongest.name} is your strongest area`,
      detail: 'Protect this one — it is usually what carries a relationship through the weaker areas.',
      categorySlug: strongest.slug,
    });
  }

  return insights;
}

export const RISK_META: Record<RiskLevel, { label: string; className: string; description: string }> = {
  healthy: {
    label: 'Healthy',
    className: 'text-emerald-600 dark:text-emerald-400',
    description: 'Balanced effort and consistent scoring from both sides.',
  },
  watch: {
    label: 'Watch',
    className: 'text-amber-600 dark:text-amber-400',
    description: 'Minor imbalance — worth one conversation this week.',
  },
  strained: {
    label: 'Strained',
    className: 'text-orange-600 dark:text-orange-400',
    description: 'Effort is meaningfully one-sided over this period.',
  },
  critical: {
    label: 'Critical',
    className: 'text-rose-600 dark:text-rose-400',
    description: 'Serious imbalance or a deal-breaker area scoring low.',
  },
};

/** Rolling averages across periods — used for the trend chart. */
export function trendSeries(
  entries: FairnessEntry[],
  memberAId: string,
  memberBId: string | null
) {
  const byPeriod = new Map<string, { a: number[]; b: number[] }>();
  for (const entry of entries) {
    const bucket = byPeriod.get(entry.period) ?? { a: [], b: [] };
    const effort = effortOf(entry);
    if (effort === null) continue;
    if (entry.user_id === memberAId) bucket.a.push(effort);
    else if (memberBId && entry.user_id === memberBId) bucket.b.push(effort);
    byPeriod.set(entry.period, bucket);
  }
  return Array.from(byPeriod.entries())
    .sort(([p1], [p2]) => p1.localeCompare(p2))
    .map(([period, { a, b }]) => {
      const ea = round(avg(a));
      const eb = round(avg(b));
      const total = ea + eb;
      return {
        period,
        effortA: ea,
        effortB: eb,
        balance: total ? round(Math.max(0, 100 - (Math.abs(ea - eb) / total) * 200)) : 0,
      };
    });
}
