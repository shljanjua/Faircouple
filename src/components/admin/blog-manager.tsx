'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { deleteBlogPostAction, saveBlogPostAction } from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Button } from '@/components/ui/button';
import { Badge, Card, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';
import { formatDate } from '@/lib/utils';

export function BlogManager({ posts, categories }: { posts: any[]; categories: any[] }) {
  const [editing, setEditing] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const open = creating || Boolean(editing);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {posts.length} posts. Every field that matters for on-page SEO is editable here.
          </p>
        </div>
        <Button
          onClick={() => {
            setCreating(true);
            setEditing(null);
          }}
        >
          <Plus className="h-4 w-4" aria-hidden />
          New post
        </Button>
      </header>

      {open && (
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{editing ? `Edit “${editing.title}”` : 'New post'}</h2>
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

          <AdminForm action={saveBlogPostAction} className="mt-4" submitLabel="Save post">
            {editing && <input type="hidden" name="id" value={editing.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" required htmlFor="title" className="sm:col-span-2">
                <Input id="title" name="title" required defaultValue={editing?.title ?? ''} />
              </Field>
              <Field label="Slug" htmlFor="slug" hint="Leave blank to generate from the title.">
                <Input id="slug" name="slug" defaultValue={editing?.slug ?? ''} />
              </Field>
              <Field label="Category" htmlFor="category_id">
                <Select id="category_id" name="category_id" defaultValue={editing?.category_id ?? ''}>
                  <option value="">— None —</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Excerpt" htmlFor="excerpt" className="sm:col-span-2">
                <Textarea id="excerpt" name="excerpt" rows={2} defaultValue={editing?.excerpt ?? ''} />
              </Field>
              <Field
                label="Content"
                hint="Markdown: ## headings, **bold**, - lists, > quotes, [links](url)."
                htmlFor="content"
                className="sm:col-span-2"
              >
                <Textarea
                  id="content"
                  name="content"
                  rows={18}
                  className="font-mono text-xs"
                  defaultValue={editing?.content ?? ''}
                />
              </Field>
              <Field label="Cover image URL" htmlFor="cover_image">
                <Input id="cover_image" name="cover_image" defaultValue={editing?.cover_image ?? ''} />
              </Field>
              <Field label="OG image URL" htmlFor="og_image">
                <Input id="og_image" name="og_image" defaultValue={editing?.og_image ?? ''} />
              </Field>
              <Field label="Meta title" htmlFor="meta_title">
                <Input id="meta_title" name="meta_title" defaultValue={editing?.meta_title ?? ''} />
              </Field>
              <Field label="Canonical URL" htmlFor="canonical_url">
                <Input id="canonical_url" name="canonical_url" defaultValue={editing?.canonical_url ?? ''} />
              </Field>
              <Field label="Meta description" htmlFor="meta_description" className="sm:col-span-2">
                <Textarea
                  id="meta_description"
                  name="meta_description"
                  rows={2}
                  defaultValue={editing?.meta_description ?? ''}
                />
              </Field>
              <Field label="Keywords" hint="Comma-separated." htmlFor="keywords">
                <Input id="keywords" name="keywords" defaultValue={(editing?.keywords ?? []).join(', ')} />
              </Field>
              <Field label="Tags" hint="Comma-separated." htmlFor="tags">
                <Input id="tags" name="tags" defaultValue={(editing?.tags ?? []).join(', ')} />
              </Field>
              <Field label="Author name" htmlFor="author_name">
                <Input
                  id="author_name"
                  name="author_name"
                  defaultValue={editing?.author_name ?? 'FairCouples Team'}
                />
              </Field>
              <Field label="Reading minutes" htmlFor="reading_minutes">
                <Input
                  id="reading_minutes"
                  name="reading_minutes"
                  type="number"
                  min="1"
                  defaultValue={editing?.reading_minutes ?? 6}
                />
              </Field>
              <Field label="Status" htmlFor="status">
                <Select id="status" name="status" defaultValue={editing?.status ?? 'draft'}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
              <Field label="Publish date" htmlFor="published_at">
                <Input
                  id="published_at"
                  name="published_at"
                  type="date"
                  defaultValue={
                    editing?.published_at ? String(editing.published_at).slice(0, 10) : ''
                  }
                />
              </Field>
              <div className="flex items-end gap-4 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="is_featured"
                    defaultChecked={editing?.is_featured ?? false}
                    className="h-4 w-4 rounded"
                  />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="no_index"
                    defaultChecked={editing?.no_index ?? false}
                    className="h-4 w-4 rounded"
                  />
                  No-index this post
                </label>
              </div>
            </div>
          </AdminForm>
        </Card>
      )}

      <Table>
        <thead>
          <tr>
            <Th>Title</Th>
            <Th>Status</Th>
            <Th>Published</Th>
            <Th>Views</Th>
            <Th className="text-right">Actions</Th>
          </tr>
        </thead>
        <tbody>
          {posts.map((post) => (
            <tr key={post.id}>
              <Td>
                <span className="font-medium">{post.title}</span>
                <span className="block text-xs text-muted-foreground">/blog/{post.slug}</span>
              </Td>
              <Td>
                <Badge
                  tone={
                    post.status === 'published' ? 'success' : post.status === 'draft' ? 'outline' : 'warning'
                  }
                >
                  {post.status}
                </Badge>
              </Td>
              <Td className="text-muted-foreground">
                {post.published_at ? formatDate(post.published_at) : '—'}
              </Td>
              <Td className="text-muted-foreground">{post.view_count ?? 0}</Td>
              <Td>
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    target="_blank"
                    className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary"
                  >
                    View
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(post);
                      setCreating(false);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Edit
                  </Button>
                  <ActionButton
                    label="Delete"
                    variant="ghost"
                    confirm="Delete this post?"
                    action={() => deleteBlogPostAction(post.id)}
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
