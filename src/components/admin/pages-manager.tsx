'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { deletePageAction, savePageAction } from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Button } from '@/components/ui/button';
import { Badge, Card, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export function PagesManager({ pages }: { pages: any[] }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const open = creating || Boolean(editing);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Legal &amp; content pages</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Privacy policy, terms, cookies, refunds, GDPR, acceptable use, disclaimer and any custom
            page — all editable, all rendered at /your-slug.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New page
        </Button>
      </header>

      {open && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editing ? `Edit “${editing.title}”` : 'New page'}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
            >
              Close
            </Button>
          </div>

          <AdminForm action={savePageAction} className="mt-4" submitLabel="Save page">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required htmlFor="title">
                <Input id="title" name="title" required defaultValue={editing?.title ?? ''} />
              </Field>
              <Field label="Slug" htmlFor="slug" hint="Rendered at /slug">
                <Input id="slug" name="slug" defaultValue={editing?.slug ?? ''} />
              </Field>
              <Field label="Type" htmlFor="page_type">
                <Select id="page_type" name="page_type" defaultValue={editing?.page_type ?? 'legal'}>
                  <option value="legal">Legal</option>
                  <option value="marketing">Marketing</option>
                  <option value="support">Support</option>
                  <option value="custom">Custom</option>
                </Select>
              </Field>
              <Field label="Status" htmlFor="status">
                <Select id="status" name="status" defaultValue={editing?.status ?? 'published'}>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <Field
                label="Content"
                hint="Markdown supported."
                htmlFor="content"
                className="sm:col-span-2"
              >
                <Textarea
                  id="content"
                  name="content"
                  rows={20}
                  className="font-mono text-xs"
                  defaultValue={editing?.content ?? ''}
                />
              </Field>
              <Field label="Meta title" htmlFor="meta_title">
                <Input id="meta_title" name="meta_title" defaultValue={editing?.meta_title ?? ''} />
              </Field>
              <Field label="Sort order" htmlFor="sort_order">
                <Input
                  id="sort_order"
                  name="sort_order"
                  type="number"
                  defaultValue={editing?.sort_order ?? 0}
                />
              </Field>
              <Field label="Meta description" htmlFor="meta_description" className="sm:col-span-2">
                <Textarea
                  id="meta_description"
                  name="meta_description"
                  rows={2}
                  defaultValue={editing?.meta_description ?? ''}
                />
              </Field>
              <Field label="Keywords" hint="Comma-separated." htmlFor="keywords" className="sm:col-span-2">
                <Input id="keywords" name="keywords" defaultValue={(editing?.keywords ?? []).join(', ')} />
              </Field>
              <div className="flex flex-wrap items-end gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="show_in_footer"
                    defaultChecked={editing ? editing.show_in_footer : true}
                    className="h-4 w-4 rounded"
                  />
                  Show in footer
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="show_in_header"
                    defaultChecked={editing?.show_in_header ?? false}
                    className="h-4 w-4 rounded"
                  />
                  Show in header
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="no_index"
                    defaultChecked={editing?.no_index ?? false}
                    className="h-4 w-4 rounded"
                  />
                  No-index
                </label>
              </div>
            </div>
          </AdminForm>
        </Card>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Page</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th>Updated</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id}>
              <Td>
                <span className="font-medium">{page.title}</span>
                <span className="block text-xs text-muted-foreground">/{page.slug}</span>
              </Td>
              <Td className="capitalize text-muted-foreground">{page.page_type}</Td>
              <Td>
                <Badge tone={page.status === 'published' ? 'success' : 'outline'}>{page.status}</Badge>
              </Td>
              <Td className="text-muted-foreground">{formatDate(page.updated_at)}</Td>
              <Td>
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/${page.slug}`}
                    target="_blank"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                  >
                    View
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(page);
                      setCreating(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Edit
                  </Button>
                  <ActionButton
                    label="Delete"
                    variant="ghost"
                    confirm="Delete this page?"
                    action={() => deletePageAction(page.id)}
                  />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
