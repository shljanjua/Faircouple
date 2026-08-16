'use client';

import { useMemo, useState, useTransition } from 'react';
import { Check, Lock, Trash2 } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  acknowledgeEmotionAction,
  deleteEmotionAction,
  logEmotionAction,
} from '@/app/actions/entries';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, Switch, Textarea } from '@/components/ui';
import { cn, timeAgo } from '@/lib/utils';
import type { EmotionLog, EmotionType } from '@/types';

interface Props {
  emotionTypes: EmotionType[];
  logs: EmotionLog[];
  meId: string;
  meName: string;
  partnerId: string | null;
  partnerName: string;
}

const SCOPES = [
  { value: 'self', label: 'About me', hint: 'How I feel right now' },
  { value: 'partner', label: 'About my partner', hint: 'How they made me feel' },
  { value: 'relationship', label: 'About us', hint: 'How the relationship feels' },
] as const;

export function EmotionsWorkspace({
  emotionTypes,
  logs,
  meId,
  meName,
  partnerId,
  partnerName,
}: Props) {
  const [scope, setScope] = useState<'self' | 'partner' | 'relationship'>('self');
  const [selected, setSelected] = useState<string | null>(null);
  const [intensity, setIntensity] = useState(6);
  const [isPrivate, setIsPrivate] = useState(false);
  const [note, setNote] = useState('');
  const [trigger, setTrigger] = useState('');
  const [need, setNeed] = useState('');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<'all' | 'mine' | 'partner'>('all');

  const grouped = useMemo(() => {
    const positive = emotionTypes.filter((e) => e.valence === 'positive');
    const neutral = emotionTypes.filter((e) => e.valence === 'neutral');
    const negative = emotionTypes.filter((e) => e.valence === 'negative');
    return { positive, neutral, negative };
  }, [emotionTypes]);

  const emotionMap = useMemo(
    () => new Map(emotionTypes.map((e) => [e.slug, e])),
    [emotionTypes]
  );

  const visibleLogs = useMemo(() => {
    if (filter === 'mine') return logs.filter((l) => l.user_id === meId);
    if (filter === 'partner') return logs.filter((l) => l.user_id !== meId);
    return logs;
  }, [logs, filter, meId]);

  const moodSeries = useMemo(() => {
    const byDay = new Map<string, { mine: number[]; theirs: number[] }>();
    for (const log of logs) {
      const day = log.logged_at.slice(0, 10);
      const bucket = byDay.get(day) ?? { mine: [], theirs: [] };
      const type = emotionMap.get(log.emotion_slug);
      // Map valence + intensity onto a -10..10 mood axis.
      const signed =
        type?.valence === 'negative'
          ? -log.intensity
          : type?.valence === 'positive'
            ? log.intensity
            : 0;
      if (log.user_id === meId) bucket.mine.push(signed);
      else bucket.theirs.push(signed);
      byDay.set(day, bucket);
    }
    const avg = (values: number[]) =>
      values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, values]) => ({
        day: day.slice(5),
        [meName]: avg(values.mine),
        [partnerName]: avg(values.theirs),
      }));
  }, [logs, emotionMap, meId, meName, partnerName]);

  function submit() {
    if (!selected) {
      setStatus({ ok: false, message: 'Pick an emotion first.' });
      return;
    }
    const formData = new FormData();
    formData.set('scope', scope);
    formData.set('emotion_slug', selected);
    formData.set('intensity', String(intensity));
    formData.set('mood_score', String(Math.min(10, Math.max(1, intensity))));
    formData.set('note', note);
    formData.set('trigger', trigger);
    formData.set('need', need);
    formData.set('is_private', isPrivate ? 'true' : 'false');

    startTransition(async () => {
      const result = await logEmotionAction(formData);
      if (!result.ok) {
        setStatus({ ok: false, message: result.error });
        return;
      }
      setStatus({ ok: true, message: 'Logged.' });
      setSelected(null);
      setNote('');
      setTrigger('');
      setNeed('');
      setIntensity(6);
      setTimeout(() => setStatus(null), 2500);
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Emotions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log what you feel — about yourself, about {partnerName}, or about the relationship. Both of
          you write your own entries.
        </p>
      </header>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Card className="p-5">
          <h2 className="font-semibold">Log an emotion</h2>

          <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Scope">
            {SCOPES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={scope === option.value}
                onClick={() => setScope(option.value)}
                disabled={option.value === 'partner' && !partnerId}
                className={cn(
                  'rounded-lg border p-3 text-left text-sm transition-colors disabled:opacity-50',
                  scope === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-secondary'
                )}
              >
                <span className="block font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-4">
            {(
              [
                ['Positive', grouped.positive],
                ['Neutral', grouped.neutral],
                ['Difficult', grouped.negative],
              ] as const
            ).map(([label, list]) => (
              <div key={label}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {list.map((emotion) => (
                    <button
                      key={emotion.slug}
                      type="button"
                      onClick={() => setSelected(emotion.slug)}
                      aria-pressed={selected === emotion.slug}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-all',
                        selected === emotion.slug
                          ? 'border-primary bg-primary/10 font-medium text-primary'
                          : 'border-border hover:bg-secondary'
                      )}
                    >
                      <span aria-hidden>{emotion.emoji}</span>
                      {emotion.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-sm">
              <label htmlFor="intensity" className="font-medium">
                Intensity
              </label>
              <span className="font-bold tabular-nums">{intensity}/10</span>
            </div>
            <input
              id="intensity"
              type="range"
              min={1}
              max={10}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              className="mt-2"
            />
          </div>

          <div className="mt-5 space-y-4">
            <Field label="What triggered it?" htmlFor="trigger">
              <Input
                id="trigger"
                value={trigger}
                onChange={(e) => setTrigger(e.target.value)}
                placeholder="The call about the weekend plans"
              />
            </Field>
            <Field label="What do you need right now?" htmlFor="need">
              <Input
                id="need"
                value={need}
                onChange={(e) => setNeed(e.target.value)}
                placeholder="Twenty minutes to talk, no phones"
              />
            </Field>
            <Field label="Note" htmlFor="note">
              <Textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Say the real thing, not the safe version."
              />
            </Field>
            <Switch
              checked={isPrivate}
              onChange={setIsPrivate}
              label="Keep this private"
              description={`${partnerName} will not see it. It still counts in your own trends.`}
            />
          </div>

          <Button className="mt-5 w-full" onClick={submit} loading={pending}>
            Log emotion
          </Button>
        </Card>

        <div className="space-y-5">
          {moodSeries.length > 1 && (
            <Card className="p-5">
              <h2 className="font-semibold">Mood over the last 30 days</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Positive emotions push the line up, difficult ones push it down.
              </p>
              <div className="mt-4 h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={moodSeries} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
                    <defs>
                      <linearGradient id="mine" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="theirs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#c026d3" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#c026d3" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                    <YAxis domain={[-10, 10]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={meName}
                      stroke="#f43f5e"
                      fill="url(#mine)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey={partnerName}
                      stroke="#c026d3"
                      fill="url(#theirs)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Timeline</h2>
              <div className="flex gap-1">
                {(['all', 'mine', 'partner'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-xs font-medium capitalize',
                      filter === value ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary'
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            {visibleLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nothing logged yet.</p>
            ) : (
              <ul className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
                {visibleLogs.map((log) => (
                  <EmotionRow
                    key={log.id}
                    log={log}
                    emotion={emotionMap.get(log.emotion_slug)}
                    isMine={log.user_id === meId}
                    authorName={log.user_id === meId ? meName : partnerName}
                  />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmotionRow({
  log,
  emotion,
  isMine,
  authorName,
}: {
  log: EmotionLog;
  emotion?: EmotionType;
  isMine: boolean;
  authorName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        <span className="text-xl" aria-hidden>
          {emotion?.emoji ?? '🙂'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="font-medium">{authorName}</span>{' '}
            <span className="text-muted-foreground">
              felt {emotion?.label ?? log.emotion_slug}
              {log.scope === 'partner' && ' about their partner'}
              {log.scope === 'relationship' && ' about the relationship'}
            </span>
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{timeAgo(log.logged_at)}</span>
            <span>· intensity {log.intensity}/10</span>
            {log.is_private && (
              <Badge tone="default">
                <Lock className="h-3 w-3" aria-hidden /> private
              </Badge>
            )}
            {log.acknowledged_at && <Badge tone="success">seen</Badge>}
          </p>
          {log.trigger && (
            <p className="mt-2 text-sm">
              <span className="font-medium">Trigger: </span>
              {log.trigger}
            </p>
          )}
          {log.note && <p className="mt-1 text-sm text-muted-foreground">{log.note}</p>}
          {log.need && (
            <p className="mt-2 rounded-md bg-primary/5 p-2 text-sm">
              <span className="font-medium">Needs: </span>
              {log.need}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1">
          {!isMine && !log.acknowledged_at && (
            <button
              type="button"
              title="Acknowledge"
              aria-label="Acknowledge"
              disabled={pending}
              onClick={() => startTransition(() => void acknowledgeEmotionAction(log.id))}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-emerald-600"
            >
              <Check className="h-4 w-4" aria-hidden />
            </button>
          )}
          {isMine && (
            <button
              type="button"
              title="Delete"
              aria-label="Delete"
              disabled={pending}
              onClick={() => startTransition(() => void deleteEmotionAction(log.id))}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
