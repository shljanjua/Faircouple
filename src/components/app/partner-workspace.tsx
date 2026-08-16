'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Check, Copy, Mail, UserMinus } from 'lucide-react';
import {
  invitePartnerAction,
  removePartnerAction,
  revokeInvitationAction,
  updateCoupleAction,
  updateMemberRoleAction,
} from '@/app/actions/couple';
import { Button } from '@/components/ui/button';
import { Alert, Avatar, Badge, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { CURRENCY_LIST } from '@/lib/currency';
import { formatDate } from '@/lib/utils';
import type { Couple } from '@/types';

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
  displayRole: string | null;
  incomeShare: number | null;
  joinedAt: string;
}

export function PartnerWorkspace({
  couple,
  members,
  invitations,
  meId,
  isOwner,
  siteUrl,
}: {
  couple: Couple;
  members: Member[];
  invitations: any[];
  meId: string;
  isOwner: boolean;
  siteUrl: string;
}) {
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const pendingInvites = invitations.filter((invite) => invite.status === 'pending');
  const hasPartner = members.length >= 2;

  function run(action: () => Promise<any>, form?: HTMLFormElement) {
    startTransition(async () => {
      const result = await action();
      setStatus(
        result?.ok
          ? { ok: true, message: result.message ?? 'Saved.' }
          : { ok: false, message: result?.error ?? 'Something went wrong.' }
      );
      if (result?.ok && form) form.reset();
      setTimeout(() => setStatus(null), 4000);
    });
  }

  const inviteLink = `${siteUrl}/join/${couple.invite_code}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">Partner &amp; space</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A space holds two people. Both log their own entries — from anywhere in the world.
        </p>
      </header>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      <Card className="p-5">
        <h2 className="font-semibold">Members</h2>
        <ul className="mt-4 space-y-3">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center"
            >
              <Avatar src={member.avatar} name={member.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {member.name}
                  {member.userId === meId && (
                    <span className="ml-2 text-xs text-muted-foreground">(you)</span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                <p className="mt-1 flex flex-wrap gap-2 text-xs">
                  <Badge tone={member.role === 'owner' ? 'primary' : 'default'}>{member.role}</Badge>
                  {member.displayRole && <Badge tone="outline">{member.displayRole}</Badge>}
                  {member.incomeShare !== null && (
                    <Badge tone="info">{member.incomeShare}% income share</Badge>
                  )}
                  <span className="text-muted-foreground">
                    joined {formatDate(member.joinedAt)}
                  </span>
                </p>
              </div>

              <form
                className="flex shrink-0 items-end gap-2"
                onSubmit={(event: FormEvent<HTMLFormElement>) => {
                  event.preventDefault();
                  run(() => updateMemberRoleAction(new FormData(event.currentTarget)));
                }}
              >
                <input type="hidden" name="member_id" value={member.id} />
                <div className="w-36">
                  <Input
                    name="display_role"
                    defaultValue={member.displayRole ?? ''}
                    placeholder="Role label"
                    aria-label={`Role label for ${member.name}`}
                    className="h-9 text-sm"
                  />
                </div>
                <Button type="submit" variant="outline" size="sm" loading={pending}>
                  Save
                </Button>
              </form>

              {isOwner && member.userId !== meId && (
                <div className="shrink-0">
                  {confirmRemove === member.userId ? (
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        loading={pending}
                        onClick={() => {
                          run(() => removePartnerAction(member.userId));
                          setConfirmRemove(null);
                        }}
                      >
                        Confirm
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmRemove(member.userId)}
                    >
                      <UserMinus className="h-3.5 w-3.5" aria-hidden />
                      Remove
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {isOwner && hasPartner && (
          <p className="mt-4 text-xs text-muted-foreground">
            Removing a partner ends their access immediately. Their own private entries stay in their
            account; shared entries remain in this space.
          </p>
        )}
      </Card>

      {!hasPartner && (
        <Card className="p-5">
          <h2 className="font-semibold">Invite the other person</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            They create their own login and answer independently. The fairness report needs both
            sides.
          </p>

          <form
            className="mt-4 space-y-4"
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              const form = event.currentTarget;
              run(() => invitePartnerAction(new FormData(form)), form);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Their email" required htmlFor="email">
                <Input id="email" name="email" type="email" required placeholder="partner@example.com" />
              </Field>
              <Field label="Their role label" htmlFor="display_role">
                <Input id="display_role" name="display_role" placeholder="Partner B / Son / Sister" />
              </Field>
            </div>
            <Field label="Message" htmlFor="message">
              <Textarea id="message" name="message" rows={2} placeholder="Join me — we both track our own side." />
            </Field>
            <Button type="submit" loading={pending}>
              <Mail className="h-4 w-4" aria-hidden />
              Send invitation
            </Button>
          </form>

          <div className="mt-6 rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Or share the join code</p>
            <div className="mt-2 flex gap-2">
              <Input readOnly value={inviteLink} className="text-xs" aria-label="Invite link" />
              <Button
                type="button"
                variant="outline"
                aria-label="Copy invite link"
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {pendingInvites.length > 0 && (
        <Card className="p-5">
          <h2 className="font-semibold">Pending invitations</h2>
          <ul className="mt-3 space-y-2">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {invite.email}
                  <span className="ml-2 text-xs text-muted-foreground">
                    expires {formatDate(invite.expires_at)}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  loading={pending}
                  onClick={() => run(() => revokeInvitationAction(invite.id))}
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-5">
        <h2 className="font-semibold">Space settings</h2>
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            run(() => updateCoupleAction(new FormData(event.currentTarget)));
          }}
        >
          <Field label="Space name" htmlFor="name">
            <Input id="name" name="name" defaultValue={couple.name ?? ''} />
          </Field>
          <Field label="Relationship type" htmlFor="relationship_type">
            <Select id="relationship_type" name="relationship_type" defaultValue={couple.relationship_type}>
              <option value="romantic">Dating / partners</option>
              <option value="engaged">Engaged</option>
              <option value="married">Married</option>
              <option value="long_distance">Long-distance</option>
              <option value="parent_child">Parent &amp; child</option>
              <option value="siblings">Siblings</option>
              <option value="friends">Close friends</option>
              <option value="family">Other family</option>
            </Select>
          </Field>
          <Field label="Anniversary" htmlFor="anniversary_date">
            <Input
              id="anniversary_date"
              name="anniversary_date"
              type="date"
              defaultValue={couple.anniversary_date ?? ''}
            />
          </Field>
          <Field label="Shared currency" htmlFor="currency">
            <Select id="currency" name="currency" defaultValue={couple.currency}>
              {CURRENCY_LIST.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.flag} {option.code}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Expense fairness rule"
            hint="Proportional splits leave you both with the same share of free income."
            htmlFor="fairness_weighting"
            className="sm:col-span-2"
          >
            <Select
              id="fairness_weighting"
              name="fairness_weighting"
              defaultValue={couple.fairness_weighting}
            >
              <option value="equal">Equal — 50 / 50</option>
              <option value="income_based">Proportional to income</option>
              <option value="custom">Custom</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={pending}>
              Save space settings
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
