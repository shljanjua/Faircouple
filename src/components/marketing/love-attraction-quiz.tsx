'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { saveLoveAssessmentAction } from '@/app/actions/assessment';
import { Button, ButtonLink } from '@/components/ui/button';
import { Alert, Badge, Card, Progress } from '@/components/ui';
import { LIKERT, LOVE_ATTRACTION_QUESTIONS, scoreAssessment } from '@/lib/assessment';
import { cn } from '@/lib/utils';

export function LoveAttractionQuiz({ signedIn }: { signedIn: boolean }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const answeredCount = Object.keys(answers).length;
  const result = useMemo(() => scoreAssessment(answers), [answers]);
  const progress = (answeredCount / LOVE_ATTRACTION_QUESTIONS.length) * 100;

  if (submitted) {
    return (
      <div className="space-y-6">
        <Card className="p-6 text-center">
          <Badge tone="primary" className="mx-auto">
            Your result
          </Badge>
          <h2 className="mt-4 font-display text-3xl font-bold">{result.verdict}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{result.summary}</p>

          <div className="mx-auto mt-8 grid max-w-lg gap-5 sm:grid-cols-2">
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">Love</span>
                <span className="text-2xl font-bold tabular-nums">{result.loveScore}</span>
              </div>
              <Progress value={result.loveScore} className="mt-2" barClassName="bg-rose-500" />
              <p className="mt-1 text-xs text-muted-foreground">Consistency, effort, repair</p>
            </div>
            <div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">Attraction</span>
                <span className="text-2xl font-bold tabular-nums">{result.attractionScore}</span>
              </div>
              <Progress value={result.attractionScore} className="mt-2" barClassName="bg-fuchsia-500" />
              <p className="mt-1 text-xs text-muted-foreground">Intensity, novelty, chemistry</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">What to do next</h3>
          <ul className="mt-4 space-y-3">
            {result.guidance.map((item) => (
              <li key={item} className="flex gap-3 text-sm">
                <span className="text-primary" aria-hidden>
                  →
                </span>
                <span className="text-muted-foreground">{item}</span>
              </li>
            ))}
          </ul>
        </Card>

        {saved && <Alert tone="success">Result saved to your account.</Alert>}

        <Card className="bg-gradient-to-br from-rose-500/5 to-fuchsia-500/5 p-6 text-center">
          <h3 className="text-xl font-bold">Now have your partner take it — separately</h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            One person&apos;s answers describe one person&apos;s experience. The gap between two
            independent results is what actually tells you something.
          </p>
          <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {signedIn ? (
              <>
                <Button
                  loading={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const saveResult = await saveLoveAssessmentAction(answers);
                      if (saveResult.ok) setSaved(true);
                    })
                  }
                  disabled={saved}
                >
                  {saved ? 'Saved to your account' : 'Save this result'}
                </Button>
                <ButtonLink href="/dashboard/partner" variant="outline">
                  Invite your partner
                </ButtonLink>
              </>
            ) : (
              <>
                <ButtonLink href="/signup" size="lg">
                  Save my result — free account
                </ButtonLink>
                <ButtonLink href="/fairness" variant="outline" size="lg">
                  Read the fairness framework
                </ButtonLink>
              </>
            )}
          </div>
        </Card>

        <div className="text-center">
          <Button
            variant="ghost"
            onClick={() => {
              setAnswers({});
              setSubmitted(false);
              setSaved(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Take it again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="sticky top-16 z-20 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {answeredCount} of {LOVE_ATTRACTION_QUESTIONS.length} answered
          </span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="mt-2" />
      </Card>

      <Card className="p-6">
        <p className="text-sm text-muted-foreground">
          Answer for how things actually are, not how you would like them to be. Nobody sees your
          answers unless you save them to an account.
        </p>

        <ol className="mt-8 space-y-7">
          {LOVE_ATTRACTION_QUESTIONS.map((question, index) => (
            <li key={question.id}>
              <p className="text-sm font-medium">
                {index + 1}. {question.text}
              </p>
              {question.helper && (
                <p className="mt-0.5 text-xs text-muted-foreground">{question.helper}</p>
              )}
              <div className="mt-2.5 grid grid-cols-5 gap-1.5">
                {LIKERT.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.value }))}
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

        <div className="mt-8">
          <Button
            size="lg"
            className="w-full"
            disabled={answeredCount < 12}
            onClick={() => {
              setSubmitted(true);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            {answeredCount < 12
              ? `Answer ${12 - answeredCount} more to see your result`
              : 'See my result'}
          </Button>
          <p className="mt-3 text-center text-xs text-muted-foreground">
            By continuing you agree to our{' '}
            <Link href="/terms-of-service" className="underline">
              Terms
            </Link>
            . This is not therapy or professional advice.
          </p>
        </div>
      </Card>
    </div>
  );
}
