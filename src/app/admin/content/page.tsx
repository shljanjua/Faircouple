import type { Metadata } from 'next';
import { query } from '@/lib/db';
import { buildMetadata } from '@/lib/seo';
import { deleteRowAction, saveFaqAction, saveTestimonialAction } from '@/app/actions/admin';
import { ActionButton, AdminForm } from '@/components/admin/form-shell';
import { Badge, Card, Field, Input, Select, Table, Td, Textarea, Th } from '@/components/ui';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ title: 'FAQ & testimonials', noIndex: true });
}

export default async function AdminContentPage() {
  const [faqs, testimonials] = await Promise.all([
    query<any>(`SELECT * FROM faqs ORDER BY sort_order ASC`),
    query<any>(`SELECT * FROM testimonials ORDER BY sort_order ASC`),
  ]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">FAQ &amp; testimonials</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          FAQ entries feed the public FAQ page and the FAQPage schema that earns rich results.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold">Add an FAQ</h2>
          <AdminForm action={saveFaqAction} className="mt-4" submitLabel="Save FAQ" resetOnSuccess>
            <div className="space-y-4">
              <Field label="Question" required htmlFor="question">
                <Input id="question" name="question" required />
              </Field>
              <Field label="Answer" required htmlFor="answer">
                <Textarea id="answer" name="answer" rows={3} required />
              </Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Category" htmlFor="category">
                  <Select id="category" name="category" defaultValue="general">
                    <option value="general">General</option>
                    <option value="product">Product</option>
                    <option value="billing">Billing</option>
                    <option value="privacy">Privacy</option>
                    <option value="travel">Travel</option>
                  </Select>
                </Field>
                <Field label="Page path" htmlFor="page_path" hint="Optional, e.g. /pricing">
                  <Input id="page_path" name="page_path" />
                </Field>
                <Field label="Sort order" htmlFor="sort_order">
                  <Input id="sort_order" name="sort_order" type="number" defaultValue={0} />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 rounded" />
                Active
              </label>
            </div>
          </AdminForm>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">Add a testimonial</h2>
          <AdminForm
            action={saveTestimonialAction}
            className="mt-4"
            submitLabel="Save testimonial"
            resetOnSuccess
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" required htmlFor="author_name">
                  <Input id="author_name" name="author_name" required />
                </Field>
                <Field label="Role" htmlFor="author_role">
                  <Input id="author_role" name="author_role" placeholder="Married 6 years" />
                </Field>
                <Field label="Location" htmlFor="author_location">
                  <Input id="author_location" name="author_location" placeholder="Manchester, UK" />
                </Field>
                <Field label="Rating" htmlFor="rating">
                  <Select id="rating" name="rating" defaultValue="5">
                    {[5, 4, 3, 2, 1].map((value) => (
                      <option key={value} value={value}>
                        {value} stars
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Quote" required htmlFor="quote">
                <Textarea id="quote" name="quote" rows={3} required />
              </Field>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_featured" defaultChecked className="h-4 w-4 rounded" />
                  Featured
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="is_active" defaultChecked className="h-4 w-4 rounded" />
                  Active
                </label>
                <Field label="Sort" htmlFor="t-sort" className="w-24">
                  <Input id="t-sort" name="sort_order" type="number" defaultValue={0} />
                </Field>
              </div>
            </div>
          </AdminForm>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold">FAQ entries</h2>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Question</Th>
                <Th>Category</Th>
                <Th>Page</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {faqs.map((faq) => (
                <tr key={faq.id}>
                  <Td className="max-w-md">
                    <span className="font-medium">{faq.question}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{faq.answer}</span>
                  </Td>
                  <Td className="capitalize text-muted-foreground">{faq.category}</Td>
                  <Td className="font-mono text-xs text-muted-foreground">{faq.page_path ?? '—'}</Td>
                  <Td>
                    <Badge tone={faq.is_active ? 'success' : 'outline'}>
                      {faq.is_active ? 'active' : 'hidden'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <ActionButton
                      label="Delete"
                      variant="ghost"
                      confirm="Delete this FAQ?"
                      action={() => deleteRowAction('faqs', faq.id)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-semibold">Testimonials</h2>
        <div className="mt-4">
          <Table>
            <thead>
              <tr>
                <Th>Author</Th>
                <Th>Quote</Th>
                <Th>Rating</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {testimonials.map((testimonial) => (
                <tr key={testimonial.id}>
                  <Td>
                    <span className="font-medium">{testimonial.author_name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {[testimonial.author_role, testimonial.author_location]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </Td>
                  <Td className="max-w-md text-xs text-muted-foreground">{testimonial.quote}</Td>
                  <Td>{'★'.repeat(testimonial.rating)}</Td>
                  <Td>
                    <Badge tone={testimonial.is_active ? 'success' : 'outline'}>
                      {testimonial.is_active ? 'active' : 'hidden'}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <ActionButton
                      label="Delete"
                      variant="ghost"
                      confirm="Delete this testimonial?"
                      action={() => deleteRowAction('testimonials', testimonial.id)}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
