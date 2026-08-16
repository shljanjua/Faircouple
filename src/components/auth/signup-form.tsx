'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import { signUpAction, resendVerificationAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Alert, Field, Input, Select } from '@/components/ui';
import {
  CURRENCY_LIST,
  SIGNUP_COUNTRIES,
  normalizeCurrency,
  type CurrencyCode,
} from '@/lib/currency';

const RELATIONSHIP_TYPES = [
  { value: 'romantic', label: 'Dating / partners' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'married', label: 'Married' },
  { value: 'long_distance', label: 'Long-distance' },
  { value: 'parent_child', label: 'Parent & child' },
  { value: 'siblings', label: 'Siblings' },
  { value: 'friends', label: 'Close friends' },
  { value: 'family', label: 'Other family' },
];

const schema = z.object({
  fullName: z.string().min(2, 'Please enter your name'),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .regex(/[a-z]/, 'Include a lowercase letter')
    .regex(/[A-Z]/, 'Include an uppercase letter')
    .regex(/[0-9]/, 'Include a number'),
  country: z.string().min(2, 'Select your country'),
  currency: z.string().length(3),
  relationshipType: z.string().min(2),
  acceptTerms: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms to continue' }),
  }),
});

export function SignUpForm({
  defaultCountry,
  defaultCurrency,
  requireVerification,
}: {
  defaultCountry: string;
  defaultCurrency: CurrencyCode;
  requireVerification: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const planSlug = params.get('plan');
  const interval = params.get('interval') ?? 'year';
  const inviteToken = params.get('invite');
  const nextPath = params.get('next');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState(
    SIGNUP_COUNTRIES.some((c) => c.code === defaultCountry) ? defaultCountry : 'US'
  );
  const [currency, setCurrency] = useState<CurrencyCode>(
    normalizeCurrency(params.get('currency') ?? defaultCurrency)
  );
  const [relationshipType, setRelationshipType] = useState('romantic');
  const [marketing, setMarketing] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function onCountryChange(code: string) {
    setCountry(code);
    const match = SIGNUP_COUNTRIES.find((c) => c.code === code);
    if (match) setCurrency(match.currency);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setErrors({});

    const parsed = schema.safeParse({
      fullName,
      email,
      password,
      country,
      currency,
      relationshipType,
      acceptTerms,
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        fieldErrors[String(issue.path[0])] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    const form = new FormData();
    form.set('full_name', fullName.trim());
    form.set('email', email.trim().toLowerCase());
    form.set('password', password);
    form.set('country', country);
    form.set('currency', currency);
    form.set('relationship_type', relationshipType);
    form.set('marketing', String(marketing));
    form.set('accept_terms', String(acceptTerms));
    form.set('timezone', Intl.DateTimeFormat().resolvedOptions().timeZone);

    const result = await signUpAction(form);
    setLoading(false);

    if (!result.ok) {
      if (result.field) setErrors({ [result.field]: result.error });
      else setFormError(result.error);
      return;
    }

    if (result.requiresVerification) {
      setSent(true);
      return;
    }

    // Verification is off, so the account is already signed in.
    const destination = inviteToken
      ? `/invite/${inviteToken}`
      : planSlug
        ? `/checkout?plan=${planSlug}&currency=${currency}&interval=${interval}`
        : (nextPath ?? result.redirectTo ?? '/onboarding');

    router.push(destination);
    router.refresh();
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" aria-hidden />
        <h1 className="font-display text-2xl font-bold">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to <strong className="text-foreground">{email}</strong>. Click
          it to activate your account — the link is valid for 24 hours.
        </p>
        <Alert tone="info">
          Nothing arrived? Check spam, then{' '}
          <button
            type="button"
            className="font-medium underline"
            onClick={() => {
              void resendVerificationAction(email);
            }}
          >
            resend the email
          </button>
          .
        </Alert>
        <Link href="/signin" className="text-sm font-medium text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free forever plan, no card required.{' '}
          {planSlug && <>You picked the <strong className="capitalize">{planSlug}</strong> plan — checkout comes next.</>}
        </p>
      </div>

      {formError && <Alert tone="danger">{formError}</Alert>}

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Full name" required error={errors.fullName} htmlFor="fullName">
          <Input
            id="fullName"
            name="name"
            autoComplete="name"
            placeholder="Alex Morgan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </Field>

        <Field label="Email address" required error={errors.email} htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>

        <Field
          label="Password"
          required
          error={errors.password}
          hint="At least 8 characters, with an uppercase letter and a number."
          htmlFor="password"
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Country" required error={errors.country} htmlFor="country">
            <Select id="country" value={country} onChange={(e) => onCountryChange(e.target.value)}>
              {SIGNUP_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Billing currency"
            required
            hint="You can change this before you subscribe."
            htmlFor="currency"
          >
            <Select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(normalizeCurrency(e.target.value))}
            >
              {CURRENCY_LIST.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code} — {c.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="What kind of relationship is this?"
          hint="This only sets the labels — every relationship type uses the same fairness framework."
          htmlFor="relationshipType"
        >
          <Select
            id="relationshipType"
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

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <span className="text-muted-foreground">
            I agree to the{' '}
            <Link href="/terms-of-service" className="font-medium text-primary underline underline-offset-2">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy-policy" className="font-medium text-primary underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms}</p>}

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={marketing}
            onChange={(e) => setMarketing(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-input text-primary focus:ring-ring"
          />
          <span className="text-muted-foreground">
            Send me the weekly fairness tips email. Unsubscribe any time.
          </span>
        </label>

        <Button type="submit" size="lg" className="w-full" loading={loading}>
          Create my free account
        </Button>

        {requireVerification && (
          <p className="text-center text-xs text-muted-foreground">
            We will email you a confirmation link before your account is activated.
          </p>
        )}
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/signin" className="font-medium text-primary underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
