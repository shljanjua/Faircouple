'use client';

import { useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Trash2, Upload } from 'lucide-react';
import { changePasswordAction, signOutAction } from '@/app/actions/auth';
import {
  deleteMyAccountAction,
  exportMyDataAction,
  updateAvatarAction,
  updateNotificationPrefsAction,
  updateProfileAction,
} from '@/app/actions/account';
import { Button } from '@/components/ui/button';
import { Alert, Avatar, Card, Field, Input, Select, Switch, Textarea } from '@/components/ui';
import { CURRENCY_LIST, SIGNUP_COUNTRIES } from '@/lib/currency';
import type { Profile } from '@/types';

const NOTIFICATION_KEYS: { key: string; label: string; description: string }[] = [
  { key: 'email', label: 'Email notifications', description: 'Account and billing emails always send.' },
  { key: 'partner_activity', label: 'Partner activity', description: 'When your partner logs an entry or replies.' },
  { key: 'weekly_report', label: 'Weekly fairness report', description: 'A summary of both sides every week.' },
  { key: 'push', label: 'Browser notifications', description: 'Reminders for check-ins and trips.' },
];

export function SettingsWorkspace({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [tab, setTab] = useState<'profile' | 'security' | 'notifications' | 'privacy'>('profile');
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    (profile.notification_prefs as Record<string, boolean>) ?? {}
  );
  const [uploading, setUploading] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  function notify(result: any) {
    setStatus(
      result?.ok
        ? { ok: true, message: result.message ?? 'Saved.' }
        : { ok: false, message: result?.error ?? 'Something went wrong.' }
    );
    setTimeout(() => setStatus(null), 4000);
  }

  async function uploadAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ ok: false, message: 'Images must be under 5 MB.' });
      return;
    }
    setUploading(true);

    const upload = new FormData();
    upload.set('bucket', 'avatars');
    upload.set('prefix', 'avatar');
    upload.set('file', file);

    const response = await fetch('/api/upload', { method: 'POST', body: upload });
    const payload = await response.json().catch(() => ({ error: 'Upload failed.' }));
    setUploading(false);

    if (!response.ok || !payload.path) {
      setStatus({ ok: false, message: payload.error ?? 'Upload failed.' });
      return;
    }

    notify(await updateAvatarAction(payload.path));
    router.refresh();
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const current = String(formData.get('current_password') ?? '');
    const password = String(formData.get('password') ?? '');
    const confirm = String(formData.get('confirm') ?? '');

    if (password !== confirm) {
      setStatus({ ok: false, message: 'The two passwords do not match.' });
      return;
    }

    notify(await changePasswordAction(current, password));
    form.reset();
  }

  async function exportData() {
    const result = await exportMyDataAction();
    if (!result.ok) {
      notify(result);
      return;
    }
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `faircouples-export-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account, security and privacy controls.
        </p>
      </header>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: 'profile', label: 'Profile' },
          { key: 'security', label: 'Security' },
          { key: 'notifications', label: 'Notifications' },
          { key: 'privacy', label: 'Privacy & data' },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key as typeof tab)}
            className={
              tab === item.key
                ? 'rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground'
                : 'rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary'
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <Avatar src={profile.avatar_url} name={profile.full_name} size={64} />
            <div>
              <Button variant="outline" size="sm" loading={uploading} onClick={() => avatarRef.current?.click()}>
                <Upload className="h-3.5 w-3.5" aria-hidden />
                Change photo
              </Button>
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG or WebP. Max 5 MB.</p>
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void uploadAvatar(file);
                  event.target.value = '';
                }}
              />
            </div>
          </div>

          <form
            className="mt-6 grid gap-4 sm:grid-cols-2"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              startTransition(async () => {
                notify(await updateProfileAction(formData));
                router.refresh();
              });
            }}
          >
            <Field label="Full name" htmlFor="full_name">
              <Input id="full_name" name="full_name" defaultValue={profile.full_name ?? ''} />
            </Field>
            <Field label="Display name" htmlFor="display_name">
              <Input id="display_name" name="display_name" defaultValue={profile.display_name ?? ''} />
            </Field>
            <Field label="Email" htmlFor="email" hint="Contact support to change your email.">
              <Input id="email" value={profile.email} disabled />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ''} />
            </Field>
            <Field label="Date of birth" htmlFor="date_of_birth">
              <Input
                id="date_of_birth"
                name="date_of_birth"
                type="date"
                defaultValue={profile.date_of_birth ?? ''}
              />
            </Field>
            <Field label="Gender" htmlFor="gender">
              <Select id="gender" name="gender" defaultValue={profile.gender ?? ''}>
                <option value="">Prefer not to say</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non_binary">Non-binary</option>
              </Select>
            </Field>
            <Field label="Country" htmlFor="country_code">
              <Select id="country_code" name="country_code" defaultValue={profile.country_code ?? ''}>
                <option value="">—</option>
                {SIGNUP_COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Billing currency"
              htmlFor="currency"
              hint="Applies to your next subscription payment."
            >
              <Select id="currency" name="currency" defaultValue={profile.currency}>
                {CURRENCY_LIST.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.flag} {currency.code} — {currency.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Time zone" htmlFor="timezone" className="sm:col-span-2">
              <Input id="timezone" name="timezone" defaultValue={profile.timezone} />
            </Field>
            <Field label="About you" htmlFor="bio" className="sm:col-span-2">
              <Textarea id="bio" name="bio" rows={3} defaultValue={profile.bio ?? ''} />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" loading={pending}>
                Save profile
              </Button>
            </div>
          </form>
        </Card>
      )}

      {tab === 'security' && (
        <Card className="p-5">
          <h2 className="font-semibold">Change password</h2>
          <form onSubmit={changePassword} className="mt-4 max-w-md space-y-4">
            <Field label="Current password" required htmlFor="current_password">
              <Input
                id="current_password"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field
              label="New password"
              required
              htmlFor="password"
              hint="At least 8 characters, with an uppercase letter and a number."
            >
              <Input id="password" name="password" type="password" autoComplete="new-password" required />
            </Field>
            <Field label="Confirm new password" required htmlFor="confirm">
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required />
            </Field>
            <Button type="submit">Update password</Button>
          </form>

          <div className="mt-8 border-t border-border pt-6">
            <h2 className="font-semibold">Sessions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Signing out here ends this session. Changing your password ends all others.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={async () => {
                await signOutAction();
                router.push('/signin');
                router.refresh();
              }}
            >
              Sign out
            </Button>
          </div>
        </Card>
      )}

      {tab === 'notifications' && (
        <Card className="p-5">
          <h2 className="font-semibold">Notifications</h2>
          <div className="mt-5 space-y-5">
            {NOTIFICATION_KEYS.map((item) => (
              <Switch
                key={item.key}
                checked={prefs[item.key] ?? true}
                onChange={(value) => setPrefs((prev) => ({ ...prev, [item.key]: value }))}
                label={item.label}
                description={item.description}
              />
            ))}
          </div>
          <Button
            className="mt-6"
            loading={pending}
            onClick={() =>
              startTransition(async () => {
                notify(await updateNotificationPrefsAction(prefs));
              })
            }
          >
            Save preferences
          </Button>
        </Card>
      )}

      {tab === 'privacy' && (
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-semibold">Export your data</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Download everything you have entered as JSON — emotions, fairness entries, check-ins,
              assessments, expenses, gifts, trips and documents.
            </p>
            <Button variant="outline" className="mt-4" onClick={exportData}>
              <Download className="h-4 w-4" aria-hidden />
              Download my data
            </Button>
          </Card>

          <Card className="border-destructive/40 p-5">
            <h2 className="font-semibold text-destructive">Delete your account</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This removes your private entries, ends your access to shared spaces and cancels
              future billing. Financial records required by law are retained. This cannot be undone.
            </p>
            <div className="mt-4 max-w-sm space-y-3">
              <Field label="Type DELETE to confirm" htmlFor="confirm-delete">
                <Input
                  id="confirm-delete"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder="DELETE"
                />
              </Field>
              <Button
                variant="destructive"
                disabled={confirmText.trim().toUpperCase() !== 'DELETE'}
                loading={pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await deleteMyAccountAction(confirmText);
                    notify(result);
                    if (result.ok) {
                      router.push('/');
                      router.refresh();
                    }
                  })
                }
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                Delete my account
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
