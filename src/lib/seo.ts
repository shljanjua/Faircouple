import type { Metadata } from 'next';
import { getPublicSettings, settingString } from '@/lib/settings';

export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || 'https://grey-opossum-178268.hostingersite.com'
).replace(/\/$/, '');

export function absoluteUrl(path = '/') {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

interface BuildMetadataInput {
  title?: string;
  description?: string;
  path?: string;
  keywords?: string[];
  image?: string;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string | null;
  modifiedTime?: string | null;
  authors?: string[];
  noIndex?: boolean;
  canonical?: string | null;
}

export async function buildMetadata(input: BuildMetadataInput = {}): Promise<Metadata> {
  const settings = await getPublicSettings();
  const siteName = settingString(settings, 'site_name', 'FairCouples');
  const defaultTitle = settingString(settings, 'seo_default_title');
  const template = settingString(settings, 'seo_title_template', '%s | FairCouples');
  const defaultDescription = settingString(settings, 'site_description');
  const defaultImage = settingString(settings, 'seo_og_image', '/og');
  const twitterHandle = settingString(settings, 'seo_twitter_handle', '@faircouples');
  const siteNoIndex = settings.seo_noindex_site === true;

  const title = input.title ? template.replace('%s', input.title) : defaultTitle;
  const description = input.description || defaultDescription;
  const canonical = input.canonical || absoluteUrl(input.path ?? '/');
  const image = input.image || defaultImage;
  const imageUrl = image.startsWith('http') ? image : absoluteUrl(image);
  const noIndex = siteNoIndex || input.noIndex === true;

  const globalKeywords = Array.isArray(settings.seo_keywords)
    ? (settings.seo_keywords as string[])
    : [];

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: [...(input.keywords ?? []), ...globalKeywords].slice(0, 25),
    authors: input.authors?.map((name) => ({ name })) ?? [{ name: siteName }],
    applicationName: siteName,
    alternates: { canonical },
    robots: noIndex
      ? { index: false, follow: false, nocache: true }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-image-preview': 'large',
            'max-snippet': -1,
            'max-video-preview': -1,
          },
        },
    openGraph: {
      type: input.type ?? 'website',
      siteName,
      title,
      description,
      url: canonical,
      locale: 'en_US',
      images: [{ url: imageUrl, width: 1200, height: 630, alt: title }],
      ...(input.publishedTime ? { publishedTime: input.publishedTime } : {}),
      ...(input.modifiedTime ? { modifiedTime: input.modifiedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
      site: twitterHandle,
      creator: twitterHandle,
    },
    verification: {
      google: settingString(settings, 'seo_google_verification') || undefined,
      yandex: settingString(settings, 'seo_yandex_verification') || undefined,
      other: {
        'msvalidate.01': settingString(settings, 'seo_bing_verification') || '',
        'p:domain_verify': settingString(settings, 'seo_pinterest_verification') || '',
      },
    },
    category: 'Relationships',
  };
}

/* ------------------------------------------------------------------ */
/* JSON-LD builders                                                    */
/* ------------------------------------------------------------------ */

export function organizationSchema(settings: Record<string, any>) {
  const socials = [
    settings.social_twitter,
    settings.social_instagram,
    settings.social_facebook,
    settings.social_pinterest,
    settings.social_linkedin,
    settings.social_youtube,
    settings.social_tiktok,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: settingString(settings, 'site_name', 'FairCouples'),
    url: SITE_URL,
    logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.svg') },
    description: settingString(settings, 'site_description'),
    email: settingString(settings, 'support_email'),
    sameAs: socials,
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: settingString(settings, 'support_email'),
        availableLanguage: ['English'],
        areaServed: ['US', 'GB', 'CA', 'AU', 'IE', 'EU'],
      },
    ],
  };
}

export function websiteSchema(settings: Record<string, any>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: settingString(settings, 'site_name', 'FairCouples'),
    url: SITE_URL,
    description: settingString(settings, 'site_description'),
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en',
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function softwareApplicationSchema(params: {
  settings: Record<string, any>;
  lowPrice: number;
  highPrice: number;
  currency: string;
  ratingValue?: number;
  ratingCount?: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: settingString(params.settings, 'site_name', 'FairCouples'),
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    url: SITE_URL,
    description: settingString(params.settings, 'site_description'),
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: params.lowPrice.toFixed(2),
      highPrice: params.highPrice.toFixed(2),
      priceCurrency: params.currency,
      offerCount: 4,
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: (params.ratingValue ?? 4.8).toFixed(1),
      ratingCount: params.ratingCount ?? 428,
      bestRating: '5',
      worstRating: '1',
    },
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function articleSchema(post: {
  title: string;
  description: string;
  slug: string;
  image?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  author?: string | null;
  keywords?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    image: post.image ? [post.image] : [absoluteUrl('/og')],
    datePublished: post.publishedAt ?? undefined,
    dateModified: post.updatedAt ?? post.publishedAt ?? undefined,
    author: { '@type': 'Organization', name: post.author ?? 'FairCouples' },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(`/blog/${post.slug}`) },
    keywords: post.keywords?.join(', '),
    inLanguage: 'en',
  };
}

export function touristDestinationSchema(destination: {
  name: string;
  slug: string;
  description: string;
  image?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  country?: string | null;
  rating?: number | null;
  highlights?: string[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: destination.name,
    description: destination.description,
    url: absoluteUrl(`/destinations/${destination.slug}`),
    image: destination.image ?? undefined,
    ...(destination.latitude && destination.longitude
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: destination.latitude,
            longitude: destination.longitude,
          },
        }
      : {}),
    address: destination.country
      ? { '@type': 'PostalAddress', addressCountry: destination.country }
      : undefined,
    touristType: ['Couples', 'Honeymooners'],
    includesAttraction: destination.highlights?.map((name) => ({
      '@type': 'TouristAttraction',
      name,
    })),
    aggregateRating: destination.rating
      ? {
          '@type': 'AggregateRating',
          ratingValue: destination.rating,
          bestRating: 5,
          ratingCount: 120,
        }
      : undefined,
  };
}

export function productSchema(plan: {
  name: string;
  description: string;
  price: number;
  currency: string;
  slug: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `FairCouples ${plan.name}`,
    description: plan.description,
    brand: { '@type': 'Brand', name: 'FairCouples' },
    offers: {
      '@type': 'Offer',
      price: plan.price.toFixed(2),
      priceCurrency: plan.currency,
      availability: 'https://schema.org/InStock',
      url: absoluteUrl(`/pricing#${plan.slug}`),
    },
  };
}

export function howToSchema(params: {
  name: string;
  description: string;
  steps: { name: string; text: string }[];
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: params.name,
    description: params.description,
    step: params.steps.map((step, index) => ({
      '@type': 'HowToStep',
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}
