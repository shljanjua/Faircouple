'use client';

import { useMemo, useState, useTransition } from 'react';
import { Eye, EyeOff, Lock, Save, Send } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { saveFairnessEntryAction, snapshotReportAction, emailWeeklyReportAction } from '@/app/actions/fairness';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Progress, Switch, Textarea } from '@/components/ui';
import { RISK_META, type FairnessReport } from '@/lib/fairness';
import { cn, formatDate } from '@/lib/utils';
import type { FairnessCategory, FairnessEntry } from '@/types';

interface Props {
  period: string;
  categories: FairnessCategory[];
  entries: FairnessEntry[];
  responses: any[];
  report: FairnessReport;
  trend: { period: string; effortA: number; effortB: number; balance: number }[];
  meId: string;
  partnerId: string | null;
  meName: string;
  partnerName: string;
  canSeeAdvanced: boolean;
}

const SCALE_LABELS = ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'];

export function FairnessWorkspace(props: Props) {
  const { categories, entries, report, meId, partnerId, meName, partnerName } = props;
  const [tab, setTab] = useState<'entry' | 'report' | 'partner'>('entry');

  const myEntries = useMemo(
    () => new Map(entries.filter((e) => e.user_id === meId).map((e) => [e.category_id, e])),
    [entries, meId]
  );
  const partnerEntries = useMemo(
    () =>
      new Map(
        entries.filter((e) => partnerId && e.user_id === partnerId).map((e) => [e.category_id, e])
      ),
    [entries, partnerId]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: 'entry', label: 'My entry' },
          { key: 'report', label: 'Shared report' },
          { key: 'partner', label: `${partnerName}'s side` },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key as typeof tab)}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors',
              tab === item.key
                ? 'bg-primary text-primary-foreground'
                : 'border border-border bg-card hover:bg-secondary'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'entry' && (
        <div className="space-y-4">
          {categories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              entry={myEntries.get(category.id) ?? null}
              responses={props.responses.filter(
                (r) => r.user_id === meId && r.category_id === category.id
              )}
              period={props.period}
              partnerName={partnerName}
            />
          ))}
        </div>
      )}

      {tab === 'report' && (
        <ReportView
          report={report}
          trend={props.trend}
          meName={meName}
          partnerName={partnerName}
          canSeeAdvanced={props.canSeeAdvanced}
          period={props.period}
        />
      )}

      {tab === 'partner' && (
        <PartnerView
          categories={categories}
          entries={partnerEntries}
          partnerName={partnerName}
          hasPartner={Boolean(partnerId)}
        />
      )}
    </div>
  );
}

function CategoryCard({
  category,
  entry,
  responses,
  period,
  partnerName,
}: {
  category: FairnessCategory;
  entry: FairnessEntry | null;
  responses: any[];
  period: string;
  partnerName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [selfScore, setSelfScore] = useState(entry?.self_score ?? 5);
  const [partnerScore, setPartnerScore] = useState(entry?.partner_score ?? 5);
  const [isPrivate, setIsPrivate] = useState(entry?.is_private ?? false);
  const [note, setNote] = useState(entry?.note ?? '');
  const [partnerNote, setPartnerNote] = useState(entry?.partner_note ?? '');
  const [criteria, setCriteria] = useState<Record<string, { self?: number; partner?: number }>>(
    () => {
      const map: Record<string, { self?: number; partner?: number }> = {};
      for (const response of responses) {
        map[response.criterion_id] = {
          self: response.self_value ?? undefined,
          partner: response.partner_value ?? undefined,
        };
      }
      return map;
    }
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  function save() {
    const formData = new FormData();
    formData.set('category_id', category.id);
    formData.set('period', period);
    formData.set('self_score', String(selfScore));
    formData.set('partner_score', String(partnerScore));
    formData.set('effort_self', String(selfScore * 10));
    formData.set('effort_partner', String(partnerScore * 10));
    formData.set('respect_score', String(selfScore));
    formData.set('loyalty_score', String(partnerScore));
    formData.set('satisfaction', String(Math.round((selfScore + partnerScore) / 2)));
    formData.set('note', note);
    formData.set('partner_note', partnerNote);
    formData.set('is_private', isPrivate ? 'true' : 'false');

    for (const [criterionId, values] of Object.entries(criteria)) {
      if (values.self !== undefined) {
        formData.set(`criterion:${criterionId}:self`, String(values.self));
      }
      if (values.partner !== undefined) {
        formData.set(`criterion:${criterionId}:partner`, String(values.partner));
      }
    }

    startTransition(async () => {
      const result = await saveFairnessEntryAction(formData);
      setStatus(
        result.ok
          ? { ok: true, message: 'Saved' }
          : { ok: false, message: result.error }
      );
      setTimeout(() => setStatus(null), 2500);
    });
  }

  const answered = entry !== null;

  return (
    <Card className={cn('overflow-hidden', category.is_dealbreaker && 'border-rose-500/40')}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-4 p-5 text-left"
      >
        <span className="text-2xl" aria-hidden>
          {category.emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-semibold">{category.name}</span>
            {answered ? (
              <Badge tone="success">Answered</Badge>
            ) : (
              <Badge tone="outline">Not answered</Badge>
            )}
            {entry?.is_private && (
              <Badge tone="default">
                <Lock className="h-3 w-3" aria-hidden /> Private
              </Badge>
            )}
          </span>
          <span className="mt-0.5 block text-sm text-muted-foreground">{category.description}</span>
        </span>
        <span className="hidden shrink-0 text-right sm:block">
          <span className="block text-xs text-muted-foreground">You / {partnerName}</span>
          <span className="text-sm font-semibold tabular-nums">
            {entry?.self_score ?? '–'} / {entry?.partner_score ?? '–'}
          </span>
        </span>
      </button>

      {expanded && (
        <div className="space-y-6 border-t border-border p-5">
          <Alert tone="info">
            <strong>Fair rule:</strong> {category.fair_rule}
          </Alert>

          <ScoreSlider
            label={`How well did I uphold this?`}
            value={selfScore}
            onChange={setSelfScore}
            accent="bg-rose-500"
          />
          <ScoreSlider
            label={`How well did ${partnerName} uphold this?`}
            value={partnerScore}
            onChange={setPartnerScore}
            accent="bg-fuchsia-500"
          />

          {category.criteria && category.criteria.length > 0 && (
            <fieldset className="space-y-4">
              <legend className="text-sm font-medium">Specific behaviours</legend>
              {category.criteria.map((criterion) => (
                <div key={criterion.id} className="rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">{criterion.text}</p>
                  {criterion.help_text && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{criterion.help_text}</p>
                  )}
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <CriterionScale
                      label="Me"
                      value={criteria[criterion.id]?.self}
                      onChange={(value) =>
                        setCriteria((prev) => ({
                          ...prev,
                          [criterion.id]: { ...prev[criterion.id], self: value },
                        }))
                      }
                    />
                    <CriterionScale
                      label={partnerName}
                      value={criteria[criterion.id]?.partner}
                      onChange={(value) =>
                        setCriteria((prev) => ({
                          ...prev,
                          [criterion.id]: { ...prev[criterion.id], partner: value },
                        }))
                      }
                    />
                  </div>
                </div>
              ))}
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium">My note</span>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="What actually happened this week?"
              />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium">What I need from {partnerName}</span>
              <Textarea
                rows={3}
                value={partnerNote}
                onChange={(e) => setPartnerNote(e.target.value)}
                placeholder="One specific, doable thing."
              />
            </label>
          </div>

          <Switch
            checked={isPrivate}
            onChange={setIsPrivate}
            label="Keep this entry private"
            description={`${partnerName} will not see it. It still counts in your own trend data.`}
          />

          <div className="flex items-center gap-3">
            <Button onClick={save} loading={pending}>
              <Save className="h-4 w-4" aria-hidden />
              Save entry
            </Button>
            {status && (
              <span
                className={cn(
                  'text-sm',
                  status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                )}
              >
                {status.message}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function ScoreSlider({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  accent: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-bold tabular-nums">{value}/10</span>
      </div>
      <input
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2"
        aria-label={label}
      />
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>Not at all</span>
        <span>Completely</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full', accent)} style={{ width: `${value * 10}%` }} />
      </div>
    </div>
  );
}

function CriterionScale({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="flex gap-1">
        {SCALE_LABELS.map((scaleLabel, index) => (
          <button
            key={scaleLabel}
            type="button"
            onClick={() => onChange(index)}
            aria-pressed={value === index}
            title={scaleLabel}
            className={cn(
              'flex-1 rounded-md border px-1 py-1.5 text-[11px] transition-colors',
              value === index
                ? 'border-primary bg-primary/10 font-semibold text-primary'
                : 'border-border hover:bg-secondary'
            )}
          >
            {scaleLabel}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReportView({
  report,
  trend,
  meName,
  partnerName,
  canSeeAdvanced,
  period,
}: {
  report: FairnessReport;
  trend: { period: string; effortA: number; effortB: number; balance: number }[];
  meName: string;
  partnerName: string;
  canSeeAdvanced: boolean;
  period: string;
}) {
  const risk = RISK_META[report.riskLevel];
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const categoryChart = report.categories
    .filter((c) => c.a.effort !== null || c.b.effort !== null)
    .map((c) => ({
      name: c.name.split(' ')[0],
      [meName]: c.a.effort ?? 0,
      [partnerName]: c.b.effort ?? 0,
    }));

  function saveSnapshot() {
    startTransition(async () => {
      const result = await snapshotReportAction({
        period,
        overallScore: report.overallScore,
        balanceIndex: report.balanceIndex,
        effortA: report.effortA,
        effortB: report.effortB,
        respectDelta: report.respectDelta,
        loyaltyDelta: report.loyaltyDelta,
        verdict: report.verdict,
        riskLevel: report.riskLevel,
        breakdown: report.categories,
        insights: report.insights,
      });
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      const emailed = await emailWeeklyReportAction(period);
      setMessage(emailed.ok ? (emailed.message ?? 'Report saved and emailed.') : emailed.error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Balance index
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{report.balanceIndex}</p>
          <Progress value={report.balanceIndex} className="mt-3" />
          <p className="mt-2 text-xs text-muted-foreground">100 = perfectly even effort</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overall score
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{report.overallScore}</p>
          <Progress value={report.overallScore} className="mt-3" barClassName="bg-fuchsia-500" />
          <p className="mt-2 text-xs text-muted-foreground">Weighted across all ten areas</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</p>
          <p className={cn('mt-1 text-2xl font-bold', risk.className)}>{risk.label}</p>
          <p className="mt-2 text-xs text-muted-foreground">{risk.description}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Completed
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{report.completeness}%</p>
          <Progress value={report.completeness} className="mt-3" barClassName="bg-emerald-500" />
          <p className="mt-2 text-xs text-muted-foreground">Of both partners&apos; entries</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">Verdict for the week of {formatDate(period)}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{report.verdict}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <EffortBar name={meName} value={report.effortA} color="bg-rose-500" />
          <EffortBar name={partnerName} value={report.effortB} color="bg-fuchsia-500" />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={saveSnapshot} loading={pending}>
            <Send className="h-4 w-4" aria-hidden />
            Save &amp; email this report
          </Button>
          {message && <span className="text-sm text-muted-foreground">{message}</span>}
        </div>
      </Card>

      {report.insights.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">What the numbers say</h2>
          <ul className="mt-4 space-y-3">
            {report.insights.map((insight, index) => (
              <li
                key={index}
                className={cn(
                  'rounded-lg border-l-4 bg-secondary/40 p-3',
                  insight.tone === 'positive' && 'border-emerald-500',
                  insight.tone === 'neutral' && 'border-sky-500',
                  insight.tone === 'warning' && 'border-amber-500',
                  insight.tone === 'critical' && 'border-rose-500'
                )}
              >
                <p className="text-sm font-medium">{insight.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{insight.detail}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canSeeAdvanced ? (
        <>
          <Card className="p-5">
            <h2 className="font-semibold">Effort by area</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChart} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey={meName} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={partnerName} fill="#c026d3" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {trend.length > 1 && (
            <Card className="p-5">
              <h2 className="font-semibold">12-week trend</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                A healthy relationship averages out. A permanent gap is the warning sign.
              </p>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="effortA" name={meName} stroke="#f43f5e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="effortB" name={partnerName} stroke="#c026d3" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="balance" name="Balance" stroke="#10b981" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-6 text-center">
          <h2 className="font-semibold">Trends and per-area analytics</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Upgrade to see the 12-week trend line, per-area breakdowns and exports.
          </p>
          <Button className="mt-4" onClick={() => (window.location.href = '/pricing')}>
            See plans
          </Button>
        </Card>
      )}
    </div>
  );
}

function EffortBar({ name, value, color }: { name: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{name}</span>
        <span className="tabular-nums text-muted-foreground">{value}/100</span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PartnerView({
  categories,
  entries,
  partnerName,
  hasPartner,
}: {
  categories: FairnessCategory[];
  entries: Map<string, FairnessEntry>;
  partnerName: string;
  hasPartner: boolean;
}) {
  if (!hasPartner) {
    return (
      <Card className="p-8 text-center">
        <EyeOff className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium">No partner in this space yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite them from the Partner page — they log their own entries.
        </p>
      </Card>
    );
  }

  const answered = categories.filter((c) => entries.has(c.id));

  if (!answered.length) {
    return (
      <Card className="p-8 text-center">
        <Eye className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
        <p className="mt-3 font-medium">{partnerName} has not answered this week yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Private entries are never shown here — only shared ones.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {answered.map((category) => {
        const entry = entries.get(category.id)!;
        return (
          <Card key={category.id} className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold">
                  {category.emoji} {category.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{category.fair_rule}</p>
              </div>
              <div className="shrink-0 text-right text-sm">
                <p className="text-xs text-muted-foreground">Themselves / you</p>
                <p className="font-semibold tabular-nums">
                  {entry.self_score ?? '–'} / {entry.partner_score ?? '–'}
                </p>
              </div>
            </div>
            {entry.note && (
              <p className="mt-3 rounded-lg bg-secondary/50 p-3 text-sm">
                <span className="font-medium">Their note: </span>
                {entry.note}
              </p>
            )}
            {entry.partner_note && (
              <p className="mt-2 rounded-lg border-l-4 border-primary bg-primary/5 p-3 text-sm">
                <span className="font-medium">What they need from you: </span>
                {entry.partner_note}
              </p>
            )}
          </Card>
        );
      })}
    </div>
  );
}
