import type { Metadata, Viewport } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';
import { Analytics, GtmNoScript } from '@/components/analytics';
import { CookieBanner } from '@/components/cookie-banner';
import { JsonLd } from '@/components/json-ld';
import { getPublicSettings } from '@/lib/settings';
import { buildMetadata, organizationSchema, websiteSchema } from '@/lib/seo';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK'],
});

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({ path: '/' });
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1020' },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getPublicSettings();

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${fraunces.variable}`}
    >
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <JsonLd data={[organizationSchema(settings), websiteSchema(settings)]} />
      </head>
      <body className="min-h-screen font-sans">
        <Providers settings={settings}>
          <GtmNoScript />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to content
          </a>
          {children}
          <CookieBanner />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
