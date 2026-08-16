import type { Metadata } from 'next';
import { Mail, MessageCircle, ShieldCheck } from 'lucide-react';
import { getPublicSettings, settingString } from '@/lib/settings';
import { buildMetadata, breadcrumbSchema } from '@/lib/seo';
import { JsonLd } from '@/components/json-ld';
import { ContactForm } from '@/components/marketing/contact-form';
import { Card, SectionHeading } from '@/components/ui';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Contact FairCouples',
    description:
      'Questions about your account, billing or privacy? Contact the FairCouples team — we reply within one business day.',
    path: '/contact',
  });
}

export default async function ContactPage() {
  const settings = await getPublicSettings();
  const supportEmail = settingString(settings, 'support_email', 'support@faircouples.com');
  const address = settingString(settings, 'company_address');
  const company = settingString(settings, 'company_name', 'FairCouples');

  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Contact', path: '/contact' },
        ])}
      />

      <section className="border-b border-border bg-secondary/20 py-14">
        <div className="container">
          <SectionHeading
            eyebrow="Contact"
            title="Talk to a person"
            description="Support, billing, privacy requests and press — all handled by the same small team."
          />
        </div>
      </section>

      <section className="py-12">
        <div className="container grid max-w-5xl gap-8 lg:grid-cols-[1.3fr_1fr]">
          <Card className="p-6">
            <h2 className="font-semibold">Send us a message</h2>
            <ContactForm />
          </Card>

          <div className="space-y-5">
            <Card className="p-6">
              <Mail className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">Email</h2>
              <a
                href={`mailto:${supportEmail}`}
                className="mt-1 block text-sm text-primary underline"
              >
                {supportEmail}
              </a>
              <p className="mt-2 text-sm text-muted-foreground">
                Replies within one business day. Priority support is included on Premium and
                Lifetime plans.
              </p>
            </Card>

            <Card className="p-6">
              <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">Privacy &amp; data requests</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Access, export, correction or deletion requests are handled within 30 days. You can
                also export or delete everything yourself from Settings → Privacy.
              </p>
            </Card>

            <Card className="p-6">
              <MessageCircle className="h-6 w-6 text-primary" aria-hidden />
              <h2 className="mt-3 font-semibold">{company}</h2>
              {address && <p className="mt-2 text-sm text-muted-foreground">{address}</p>}
              <p className="mt-3 text-xs text-muted-foreground">
                FairCouples is a measurement and planning tool, not therapy. If you are in immediate
                danger, contact your local emergency service.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </>
  );
}
