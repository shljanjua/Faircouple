import Link from 'next/link';
import { getPublicSettings, settingString } from '@/lib/settings';
import { getFooterPages } from '@/lib/queries';
import { Logo } from '@/components/marketing/logo';
import { NewsletterForm } from '@/components/marketing/newsletter-form';

const PRODUCT_LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/fairness', label: 'Fairness framework' },
  { href: '/love-or-attraction', label: 'Love or attraction test' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/checklists', label: 'Travel checklists' },
];

const COMPANY_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/blog', label: 'Blog' },
  { href: '/contact', label: 'Contact' },
  { href: '/faq', label: 'FAQ' },
];

export async function SiteFooter() {
  const settings = await getPublicSettings();
  const legalPages = await getFooterPages();

  const socials = [
    { href: settingString(settings, 'social_twitter'), label: 'X' },
    { href: settingString(settings, 'social_instagram'), label: 'Instagram' },
    { href: settingString(settings, 'social_facebook'), label: 'Facebook' },
    { href: settingString(settings, 'social_pinterest'), label: 'Pinterest' },
    { href: settingString(settings, 'social_linkedin'), label: 'LinkedIn' },
  ].filter((s) => s.href);

  const siteName = settingString(settings, 'site_name', 'FairCouples');

  return (
    <footer className="no-print border-t border-border bg-secondary/30">
      <div className="container py-14">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              {settingString(
                settings,
                'site_description',
                'Measure fairness, emotions and effort in your relationship — and plan the trips that follow.'
              )}
            </p>
            <NewsletterForm />
            {socials.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="text-sm text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
                  >
                    {social.label}
                  </a>
                ))}
              </div>
            )}
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Company" links={COMPANY_LINKS} />
          <FooterColumn
            title="Legal"
            links={legalPages.map((page) => ({
              href: `/${page.slug}`,
              label: page.title,
            }))}
          />
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {settingString(settings, 'company_name', siteName)}. All
            rights reserved.
          </p>
          <p className="text-xs">
            FairCouples provides self-reported measurement and education — not therapy, medical,
            legal or financial advice.
          </p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  if (!links.length) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
