'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  addChecklistItemAction,
  createChecklistAction,
  deleteChecklistAction,
  deleteChecklistItemAction,
  toggleChecklistItemAction,
} from '@/app/actions/entries';
import { Button } from '@/components/ui/button';
import { Alert, Badge, Card, Field, Input, Progress, Select } from '@/components/ui';
import { cn } from '@/lib/utils';

interface ChecklistItem {
  id: string;
  title: string;
  category: string | null;
  quantity: number;
  assigned_to: string | null;
  priority: string;
  is_done: boolean;
  done_by: string | null;
}

interface Checklist {
  id: string;
  title: string;
  emoji: string | null;
  category: string;
  description: string | null;
  due_date: string | null;
  items: ChecklistItem[];
}

export function ChecklistsWorkspace({
  checklists,
  templates,
  members,
  meId,
}: {
  checklists: Checklist[];
  templates: any[];
  members: { id: string; name: string }[];
  meId: string;
}) {
  const [showNew, setShowNew] = useState(checklists.length === 0);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const template of templates) {
      const list = map.get(template.category) ?? [];
      list.push(template);
      map.set(template.category, list);
    }
    return map;
  }, [templates]);

  function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await createChecklistAction(formData);
      setStatus(
        result.ok
          ? { ok: true, message: 'Checklist created.' }
          : { ok: false, message: result.error }
      );
      if (result.ok) setShowNew(false);
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Checklists</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Relationship rituals, travel gear and packing — assign items so one person is not
            carrying the whole mental load.
          </p>
        </div>
        <Button onClick={() => setShowNew((v) => !v)}>
          <Plus className="h-4 w-4" aria-hidden />
          New checklist
        </Button>
      </header>

      {status && <Alert tone={status.ok ? 'success' : 'danger'}>{status.message}</Alert>}

      {showNew && (
        <Card className="p-5">
          <h2 className="font-semibold">Start from a template, or build your own</h2>
          <form onSubmit={onCreate} className="mt-4 space-y-4">
            <Field label="Template" hint="Leave blank to start empty." htmlFor="template_id">
              <Select id="template_id" name="template_id" defaultValue="">
                <option value="">— No template —</option>
                {Array.from(grouped.entries()).map(([category, list]) => (
                  <optgroup key={category} label={category.replace(/_/g, ' ')}>
                    {list.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.emoji} {template.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" htmlFor="title">
                <Input id="title" name="title" placeholder="Weekend in Rome" />
              </Field>
              <Field label="Due date" htmlFor="due_date">
                <Input id="due_date" name="due_date" type="date" />
              </Field>
            </div>

            <div className="flex gap-3">
              <Button type="submit" loading={pending}>
                Create checklist
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowNew(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {checklists.length === 0 && !showNew ? (
        <Card className="p-8 text-center">
          <p className="font-medium">No checklists yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try the Weekly Fairness Ritual or a packing template.
          </p>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {checklists.map((checklist) => (
            <ChecklistCard key={checklist.id} checklist={checklist} members={members} meId={meId} />
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistCard({
  checklist,
  members,
  meId,
}: {
  checklist: Checklist;
  members: { id: string; name: string }[];
  meId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [newItem, setNewItem] = useState('');

  const done = checklist.items.filter((item) => item.is_done).length;
  const total = checklist.items.length;

  const byCategory = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    for (const item of checklist.items) {
      const key = item.category ?? 'General';
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [checklist.items]);

  function addItem(event: FormEvent) {
    event.preventDefault();
    if (!newItem.trim()) return;
    const formData = new FormData();
    formData.set('checklist_id', checklist.id);
    formData.set('title', newItem.trim());
    startTransition(async () => {
      await addChecklistItemAction(formData);
      setNewItem('');
    });
  }

  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-semibold">
            {checklist.emoji} {checklist.title}
          </h2>
          {checklist.description && (
            <p className="mt-0.5 text-xs text-muted-foreground">{checklist.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone={done === total && total > 0 ? 'success' : 'outline'}>
            {done}/{total}
          </Badge>
          <button
            type="button"
            aria-label="Delete checklist"
            onClick={() => startTransition(() => void deleteChecklistAction(checklist.id))}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <Progress value={total ? (done / total) * 100 : 0} className="mt-3" />

      <div className="mt-4 max-h-96 flex-1 space-y-4 overflow-y-auto pr-1">
        {Array.from(byCategory.entries()).map(([category, items]) => (
          <div key={category}>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </p>
            <ul className="space-y-1">
              {items.map((item) => (
                <li key={item.id} className="group flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-secondary/60">
                  <input
                    type="checkbox"
                    checked={item.is_done}
                    onChange={(event) =>
                      startTransition(
                        () => void toggleChecklistItemAction(item.id, event.target.checked)
                      )
                    }
                    className="h-4 w-4 shrink-0 rounded border-input text-primary focus:ring-ring"
                    aria-label={item.title}
                  />
                  <span
                    className={cn(
                      'min-w-0 flex-1 text-sm',
                      item.is_done && 'text-muted-foreground line-through'
                    )}
                  >
                    {item.title}
                    {item.quantity > 1 && (
                      <span className="text-muted-foreground"> ×{item.quantity}</span>
                    )}
                  </span>
                  {item.priority === 'high' && !item.is_done && (
                    <Badge tone="warning">essential</Badge>
                  )}
                  {item.assigned_to && (
                    <Badge tone="info">
                      {members.find((m) => m.id === item.assigned_to)?.name.split(' ')[0] ??
                        'assigned'}
                    </Badge>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${item.title}`}
                    onClick={() => startTransition(() => void deleteChecklistItemAction(item.id))}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <form onSubmit={addItem} className="mt-4 flex gap-2">
        <Input
          value={newItem}
          onChange={(event) => setNewItem(event.target.value)}
          placeholder="Add an item…"
          aria-label={`Add an item to ${checklist.title}`}
        />
        <Button type="submit" variant="outline" size="icon" loading={pending} aria-label="Add item">
          <Plus className="h-4 w-4" aria-hidden />
        </Button>
      </form>
    </Card>
  );
}
