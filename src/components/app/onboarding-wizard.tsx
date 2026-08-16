'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Copy } from 'lucide-react';
import { createCoupleAction, invitePartnerAction } from '@/app/actions/couple';
import { Button } from '@/components/ui/button';
import { Alert, Card, Field, Input, Select, Textarea } from '@/components/ui';

const RELATIONSHIP_TYPES = [
  { value: 'romantic', label: 'Dating / partners', roles: ['Partner A', 'Partner B'] },
  { value: 'engaged', label: 'Engaged', roles: ['Fiancé(e) A', 'Fiancé(e) B'] },
  { value: 'married', label: 'Married', roles: ['Spouse A', 'Spouse B'] },
  { value: 'long_distance', label: 'Long-distance', roles: ['Partner A', 'Partner B'] },
  { value: 'parent_child', label: 'Parent & child', roles: ['Parent', 'Child'] },
  { value: 'siblings', label: 'Siblings', roles: ['Sibling A', 'Sibling B'] },
  { value: 'friends', label: 'Close friends', roles: ['Friend A', 'Friend B'] },
  { value: 'family', label: 'Other family', roles: ['Member A', 'Member B'] },
];

export function OnboardingWizard({ defaultName }: { defaultName: string }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [relationshipType, setRelationshipType] = useState('romantic');
  const roles =
    RELATIONSHIP_TYPES.find((t) => t.value === relationshipType)?.roles ?? ['Partner A', 'Partner B'];

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createCoupleAction(new FormData(event.currentTarget));
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setStep(2);
    router.refresh();
  }

  async function onInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const result = await invitePartnerAction(new FormData(event.currentTarget));
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setInviteUrl(result.data?.inviteUrl ?? null);
    setStep(3);
  }

  return (
    <div className="mx-auto max-w-2xl">
      <ol className="mb-8 flex items-center gap-3 text-sm" aria-label="Progress">
        {['Create the space', 'Invite your partner', 'Start logging'].map((label, index) => {
          const number = index + 1;
          const done = step > number;
          const active = step === number;
          return (
            <li key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : number}
              </span>
              <span className={active ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
            </li>
          );
        })}
      </ol>

      {error && (
        <Alert tone="danger" className="mb-5">
          {error}
        </Alert>
      )}

      {step === 1 && (
        <Card className="p-6">
          <h1 className="font-display text-2xl font-bold">Create your relationship space</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A space holds two people. You each answer for yourself — that is what makes the report
            worth reading.
          </p>

          <form onSubmit={onCreate} className="mt-6 space-y-4">
            <Field label="Name your space" required htmlFor="name">
              <Input id="name" name="name" defaultValue={defaultName} required maxLength={60} />
            </Field>

            <Field label="Relationship type" required htmlFor="relationship_type">
              <Select
                id="relationship_type"
                name="relationship_type"
                value={relationshipType}
                onChange={(e) => setRelationshipType(e.target.value)}
              >
                {RELATIONSHIP_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Your role in this space"
              hint="Shown next to your entries — e.g. Mother, Son, Husband."
              htmlFor="display_role"
            >
              <Input id="display_role" name="display_role" defaultValue={roles[0]} maxLength={40} />
            </Field>

            <Field label="Anniversary or start date" htmlFor="anniversary_date">
              <Input id="anniversary_date" name="anniversary_date" type="date" />
            </Field>

            <Button type="submit" size="lg" className="w-full" loading={loading}>
              Create space
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          </form>
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h1 className="font-display text-2xl font-bold">Invite the other person</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            They get their own login and answer independently — even from another country. You can
            do this later, but the report only works with both sides.
          </p>

          <form onSubmit={onInvite} className="mt-6 space-y-4">
            <Field label="Their email address" required htmlFor="email">
              <Input id="email" name="email" type="email" placeholder="partner@example.com" required />
            </Field>

            <Field label="Their role" htmlFor="display_role">
              <Input id="display_role" name="display_role" defaultValue={roles[1]} maxLength={40} />
            </Field>

            <Field label="Add a short message" htmlFor="message">
              <Textarea
                id="message"
                name="message"
                rows={3}
                placeholder="I want us both to track our own side honestly. Join me?"
              />
            </Field>

            <div className="flex gap-3">
              <Button type="submit" size="lg" className="flex-1" loading={loading}>
                Send invitation
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push('/dashboard')}
              >
                Skip for now
              </Button>
            </div>
          </form>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6 text-center">
          <Check className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
          <h1 className="mt-4 font-display text-2xl font-bold">Invitation sent</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            They will get an email with a link. You can start logging your own entries right now —
            nothing waits on them.
          </p>

          {inviteUrl && (
            <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-3 text-left">
              <p className="text-xs font-medium text-muted-foreground">Or share this link directly</p>
              <div className="mt-2 flex gap-2">
                <Input readOnly value={inviteUrl} className="text-xs" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(inviteUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
                </Button>
              </div>
            </div>
          )}

          <Button size="lg" className="mt-6 w-full" onClick={() => router.push('/dashboard')}>
            Go to my dashboard
          </Button>
        </Card>
      )}
    </div>
  );
}
