'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { saveCompatibilityAction, saveLoveAssessmentAction } from '@/app/actions/assessment';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Progress } from '@/components/ui';
import {
  COMPATIBILITY_DIMENSIONS,
  LIKERT,
  LOVE_ATTRACTION_QUESTIONS,
  scoreAssessment,
  scoreCompatibility,
} from '@/lib/assessment';
import { cn, formatDate } from '@/lib/utils';

interface Props {
  meId: string;
  meName: string;
  partnerId: string | null;
  partnerName: string;
  myLove: any | null;
  partnerLove: any | null;
  myCompatibility: any | null;
  partnerCompatibility: any | null;
  history: any[];
}

export function CompatibilityWorkspace(props: Props) {
  const [tab, setTab] = useState<'love' | 'compatibility'>('love');

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Compatibility</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Two assessments: is this love or attraction, and where do the two of you see things
          differently? Answer independently — the gap between your answers is the useful number.
        </p>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: 'love', label: 'Love vs Attraction' },
          { key: 'compatibility', label: 'Eight dimensions' },
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

      {tab === 'love' ? (
        <LoveAssessment
          myLove={props.myLove}
          partnerLove={props.partnerLove}
          meName={props.meName}
          partnerName={props.partnerName}
        />
      ) : (
        <CompatibilityAssessment
          myCompatibility={props.myCompatibility}
          partnerCompatibility={props.partnerCompatibility}
          meName={props.meName}
          partnerName={props.partnerName}
          history={props.history}
        />
      )}
    </div>
  );
}

function LoveAssessment({
  myLove,
  partnerLove,
  meName,
  partnerName,
}: {
  myLove: any | null;
  partnerLove: any | null;
  meName: string;
  partnerName: string;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(
    () => (myLove?.answers as Record<string, number>) ?? {}
  );
  const [showForm, setShowForm] = useState(!myLove);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => scoreAssessment(answers), [answers]);
  const answeredCount = Object.keys(answers).length;

  function submit() {
    startTransition(async () => {
      const result = await saveLoveAssessmentAction(answers);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setShowForm(false);
    });
  }

  return (
    <div className="space-y-5">
      {error && <Alert tone="danger">{error}</Alert>}

      {myLove && !showForm && (
        <div className="grid gap-5 lg:grid-cols-2">
          <ResultCard
            title={`${meName}'s result`}
            loveScore={Number(myLove.love_score ?? 0)}
            attractionScore={Number(myLove.attraction_score ?? 0)}
            verdict={myLove.verdict}
            summary={myLove.summary}
            guidance={(myLove.details?.guidance as string[]) ?? []}
            takenAt={myLove.taken_at}
          />
          {partnerLove ? (
            <ResultCard
              title={`${partnerName}'s result`}
              loveScore={Number(partnerLove.love_score ?? 0)}
              attractionScore={Number(partnerLove.attraction_score ?? 0)}
              verdict={partnerLove.verdict}
              summary={partnerLove.summary}
              guidance={(partnerLove.details?.guidance as string[]) ?? []}
              takenAt={partnerLove.taken_at}
            />
          ) : (
            <Card className="flex items-center justify-center p-8 text-center">
              <div>
                <p className="font-medium">{partnerName} has not taken it yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  The comparison only means something when both of you answer independently.
                </p>
              </div>
            </Card>
          )}
        </div>
      )}

      {myLove && partnerLove && !showForm && (
        <Card className="p-5">
          <h2 className="font-semibold">Where you differ</h2>
          <div className="mt-4 space-y-4">
            <GapRow
              label="Love score"
              a={Number(myLove.love_score ?? 0)}
              b={Number(partnerLove.love_score ?? 0)}
              aName={meName}
              bName={partnerName}
            />
            <GapRow
              label="Attraction score"
              a={Number(myLove.attraction_score ?? 0)}
              b={Number(partnerLove.attraction_score ?? 0)}
              aName={meName}
              bName={partnerName}
            />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            A gap above 20 points on the love axis is worth a direct conversation — you are describing
            two different relationships.
          </p>
        </Card>
      )}

      {!showForm && (
        <Button variant="outline" onClick={() => setShowForm(true)}>
          Retake the assessment
        </Button>
      )}

      {showForm && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Answer honestly — nobody else sees your raw answers</h2>
            <Badge tone={answeredCount >= 12 ? 'success' : 'outline'}>
              {answeredCount}/{LOVE_ATTRACTION_QUESTIONS.length}
            </Badge>
          </div>

          <ol className="mt-6 space-y-6">
            {LOVE_ATTRACTION_QUESTIONS.map((question, index) => (
              <li key={question.id}>
                <p className="text-sm font-medium">
                  {index + 1}. {question.text}
                </p>
                {question.helper && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{question.helper}</p>
                )}
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {LIKERT.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({ ...prev, [question.id]: option.value }))
                      }
                      aria-pressed={answers[question.id] === option.value}
                      className={cn(
                        'rounded-md border px-1 py-2 text-[11px] transition-colors sm:text-xs',
                        answers[question.id] === option.value
                          ? 'border-primary bg-primary/10 font-semibold text-primary'
                          : 'border-border hover:bg-secondary'
                      )}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ol>

          {answeredCount >= 12 && (
            <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-4">
              <p className="text-sm font-medium">Live preview: {preview.verdict}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ScoreBar label="Love" value={preview.loveScore} className="bg-rose-500" />
                <ScoreBar label="Attraction" value={preview.attractionScore} className="bg-fuchsia-500" />
              </div>
            </div>
          )}

          <div className="mt-6 flex gap-3">
            <Button onClick={submit} loading={pending} disabled={answeredCount < 12}>
              Save my result
            </Button>
            {myLove && (
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function ResultCard({
  title,
  loveScore,
  attractionScore,
  verdict,
  summary,
  guidance,
  takenAt,
}: {
  title: string;
  loveScore: number;
  attractionScore: number;
  verdict: string;
  summary: string;
  guidance: string[];
  takenAt: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">{formatDate(takenAt)}</span>
      </div>
      <p className="mt-3 text-xl font-bold text-primary">{verdict}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ScoreBar label="Love" value={loveScore} className="bg-rose-500" />
        <ScoreBar label="Attraction" value={attractionScore} className="bg-fuchsia-500" />
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{summary}</p>
      {guidance.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {guidance.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="text-primary" aria-hidden>
                →
              </span>
              <span className="text-muted-foreground">{item}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ScoreBar({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}/100</span>
      </div>
      <Progress value={value} className="mt-1.5" barClassName={className} />
    </div>
  );
}

function GapRow({
  label,
  a,
  b,
  aName,
  bName,
}: {
  label: string;
  a: number;
  b: number;
  aName: string;
  bName: string;
}) {
  const gap = Math.abs(a - b);
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <Badge tone={gap > 20 ? 'danger' : gap > 10 ? 'warning' : 'success'}>
          {gap}-point gap
        </Badge>
      </div>
      <div className="mt-2 space-y-1.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 truncate text-muted-foreground">{aName}</span>
          <Progress value={a} barClassName="bg-rose-500" />
          <span className="w-8 shrink-0 tabular-nums text-right">{a}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 truncate text-muted-foreground">{bName}</span>
          <Progress value={b} barClassName="bg-fuchsia-500" />
          <span className="w-8 shrink-0 tabular-nums text-right">{b}</span>
        </div>
      </div>
    </div>
  );
}

function CompatibilityAssessment({
  myCompatibility,
  partnerCompatibility,
  meName,
  partnerName,
  history,
}: {
  myCompatibility: any | null;
  partnerCompatibility: any | null;
  meName: string;
  partnerName: string;
  history: any[];
}) {
  const [answers, setAnswers] = useState<Record<string, number>>(
    () => (myCompatibility?.answers as Record<string, number>) ?? {}
  );
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const partnerAnswers = (partnerCompatibility?.answers as Record<string, number>) ?? null;
  const scored = useMemo(() => scoreCompatibility(answers, partnerAnswers), [answers, partnerAnswers]);

  const radarData = scored.dimensions.map((d) => ({
    dimension: d.label,
    [meName]: d.mine * 10,
    [partnerName]: (d.theirs ?? 0) * 10,
  }));

  function submit() {
    startTransition(async () => {
      const result = await saveCompatibilityAction(answers);
      setStatus(
        result.ok
          ? { ok: true, message: 'Saved. Your partner sees the combined score once they answer.' }
          : { ok: false, message: result.error }
      );
    });
  }

  return (
    <div className="space-y-5">
      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Rate each dimension 1–10</h2>
          <div className="mt-5 space-y-5">
            {COMPATIBILITY_DIMENSIONS.map((dimension) => (
              <div key={dimension.key}>
                <div className="flex items-center justify-between text-sm">
                  <label htmlFor={dimension.key} className="font-medium">
                    {dimension.emoji} {dimension.question}
                  </label>
                  <span className="font-bold tabular-nums">{answers[dimension.key] ?? 5}</span>
                </div>
                <input
                  id={dimension.key}
                  type="range"
                  min={1}
                  max={10}
                  value={answers[dimension.key] ?? 5}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [dimension.key]: Number(e.target.value) }))
                  }
                  className="mt-2"
                />
              </div>
            ))}
          </div>
          <Button className="mt-6 w-full" onClick={submit} loading={pending}>
            Save my answers
          </Button>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="font-semibold">Combined score</h2>
              <span className="text-3xl font-bold tabular-nums">{scored.overall}</span>
            </div>
            <Progress value={scored.overall} className="mt-3" />
            {scored.biggestGap && scored.biggestGap.gap !== null && (
              <p className="mt-4 text-sm text-muted-foreground">
                Biggest perception gap: <strong>{scored.biggestGap.label}</strong> — {meName} says{' '}
                {scored.biggestGap.mine}, {partnerName} says {scored.biggestGap.theirs}.
              </p>
            )}
            {!partnerAnswers && (
              <p className="mt-4 text-sm text-muted-foreground">
                Only your answers are counted so far. Ask {partnerName} to complete theirs.
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Side by side</h2>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="72%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Radar name={meName} dataKey={meName} stroke="#f43f5e" fill="#f43f5e" fillOpacity={0.25} />
                  {partnerAnswers && (
                    <Radar
                      name={partnerName}
                      dataKey={partnerName}
                      stroke="#c026d3"
                      fill="#c026d3"
                      fillOpacity={0.2}
                    />
                  )}
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {history.length > 0 && (
            <Card className="p-5">
              <h2 className="font-semibold">History</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {history.map((row) => (
                  <li key={row.id} className="flex items-center justify-between">
                    <span className="text-muted-foreground">{formatDate(row.period)}</span>
                    <span className="font-semibold tabular-nums">{Math.round(row.overall)}/100</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
