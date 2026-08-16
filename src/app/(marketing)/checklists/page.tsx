import type { Metadata } from 'next';
import { Check } from 'lucide-react';
import { getChecklistTemplates } from '@/lib/queries';
import { buildMetadata, breadcrumbSchema, howToSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { Badge, Card, SectionHeading } from '@/components/ui';
import { ButtonLink } from '@/components/ui/button';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Couples travel checklists — documents, packing and every climate',
    description:
      'Free packing and travel checklists for couples: documents, carry-on, beach honeymoon, Europe city break, winter and aurora, hiking, electronics, health and the 72-hour pre-departure list.',
    path: '/checklists',
    keywords: [
      'couples packing list',
      'travel checklist',
      'honeymoon packing list',
      'what to pack for europe',
      'winter travel packing list',
    ],
  });
}

const CATEGORY_LABELS: Record<string, string> = {
  travel: 'Travel admin',
  packing: 'Packing',
  honeymoon: 'Honeymoon',
  relationship: 'Relationship rituals',
  finance: 'Money',
  date_night: 'Date nights',
};

export default async function ChecklistsPage() {
  const list = await getChecklistTemplates();
  const grouped = new Map<string, any[]>();
  for (const template of list) {
    grouped.set(template.category, [...(grouped.get(template.category) ?? []), template]);
  }

  return (
    <>
      <JsonLd
        data={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Checklists', path: '/checklists' },
          ]),
          howToSchema({
            name: 'How to pack for a trip as a couple',
            description:
              'Split the packing load by assigning every item to one partner instead of one person remembering everything.',
            steps: [
              { name: 'Start from a climate template', text: 'Pick the list that matches your destination and season.' },
              { name: 'Assign every item', text: 'Each item goes to one named partner, not to “us”.' },
              { name: 'Flag the essentials', text: 'Passports, medication, adapters and chargers first.' },
              { name: 'Tick as you pack', text: 'Both partners see progress in real time.' },
              { name: 'Do the 72-hour list', text: 'Check-in, transfers, bank notifications, home admin.' },
            ],
          }),
        ]}
      />

      <section className="border-b border-border bg-secondary/20 py-14">
        <div className="container">
          <SectionHeading
            eyebrow="Free checklists"
            title="Packing arguments are never about the packing"
            description="They are about one person carrying the mental load of remembering. Assign every item to a named partner instead — that is what these lists do."
          />
        </div>
      </section>

      <section className="py-12">
        <div className="container space-y-12">
          {Array.from(grouped.entries()).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-2xl font-bold">{CATEGORY_LABELS[category] ?? category}</h2>
              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                {items.map((template) => {
                  const templateItems = Array.isArray(template.items) ? template.items : [];
                  const essentials = templateItems.filter((item: any) => item.essential);
                  return (
                    <Card key={template.id} className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="flex items-center gap-2 text-lg font-semibold">
                            <span aria-hidden>{template.emoji}</span>
                            {template.name}
                          </h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {template.description}
                          </p>
                        </div>
                        <Badge tone="outline">{templateItems.length} items</Badge>
                      </div>

                      <ul className="mt-5 grid gap-1.5 sm:grid-cols-2">
                        {templateItems.slice(0, 12).map((item: any) => (
                          <li key={item.name} className="flex items-start gap-2 text-sm">
                            <Check
                              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                item.essential ? 'text-primary' : 'text-muted-foreground'
                              }`}
                              aria-hidden
                            />
                            <span className={item.essential ? 'font-medium' : 'text-muted-foreground'}>
                              {item.name}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {templateItems.length > 12 && (
                        <p className="mt-3 text-xs text-muted-foreground">
                          + {templateItems.length - 12} more items, including{' '}
                          {essentials.length} marked essential
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-secondary/20 py-14">
        <div className="container text-center">
          <h2 className="text-3xl font-bold">Use these lists properly</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Inside FairCouples every list becomes interactive: assign items to each partner, tick
            them off together in real time, and attach the list to a specific trip.
          </p>
          <ButtonLink href="/signup" size="lg" className="mt-6">
            Get the interactive versions free
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
