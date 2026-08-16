export type CurrencyCode = 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  locale: string;
  flag: string;
  countries: string[];
  region: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    locale: 'en-US',
    flag: '🇺🇸',
    countries: ['US', 'PR', 'EC', 'PA', 'SV'],
    region: 'United States',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    locale: 'en-GB',
    flag: '🇬🇧',
    countries: ['GB', 'IM', 'JE', 'GG'],
    region: 'United Kingdom',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    locale: 'de-DE',
    flag: '🇪🇺',
    countries: [
      'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR', 'SK', 'SI',
      'LT', 'LV', 'EE', 'LU', 'MT', 'CY', 'HR',
    ],
    region: 'Eurozone',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    name: 'Canadian Dollar',
    locale: 'en-CA',
    flag: '🇨🇦',
    countries: ['CA'],
    region: 'Canada',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    locale: 'en-AU',
    flag: '🇦🇺',
    countries: ['AU', 'NZ'],
    region: 'Australia & New Zealand',
  },
};

export const CURRENCY_LIST = Object.values(CURRENCIES);
export const DEFAULT_CURRENCY: CurrencyCode = 'USD';

export function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === 'string' && value in CURRENCIES;
}

export function normalizeCurrency(value?: string | null): CurrencyCode {
  const upper = (value ?? '').toUpperCase();
  return isCurrency(upper) ? upper : DEFAULT_CURRENCY;
}

/** Maps an ISO country code to the currency we bill that country in. */
export function currencyForCountry(countryCode?: string | null): CurrencyCode {
  if (!countryCode) return DEFAULT_CURRENCY;
  const code = countryCode.toUpperCase();
  for (const config of CURRENCY_LIST) {
    if (config.countries.includes(code)) return config.code;
  }
  // Everything else in Europe defaults to EUR, the rest to USD.
  const europe = [
    'NO', 'SE', 'DK', 'CH', 'IS', 'PL', 'CZ', 'HU', 'RO', 'BG', 'RS', 'UA', 'AL',
    'BA', 'ME', 'MK', 'MD', 'LI', 'MC', 'AD', 'SM', 'VA',
  ];
  return europe.includes(code) ? 'EUR' : DEFAULT_CURRENCY;
}

export function formatMoney(
  cents: number,
  currency: string = DEFAULT_CURRENCY,
  options: { compact?: boolean; showDecimals?: boolean } = {}
) {
  const code = normalizeCurrency(currency);
  const config = CURRENCIES[code];
  const amount = cents / 100;
  const showDecimals = options.showDecimals ?? !Number.isInteger(amount);

  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: code,
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
    notation: options.compact ? 'compact' : 'standard',
  }).format(amount);
}

/** Formats a plain (non-cent) amount, e.g. average daily costs from the CMS. */
export function formatAmount(amount: number, currency: string = DEFAULT_CURRENCY) {
  return formatMoney(Math.round(amount * 100), currency);
}

export const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  GBP: 0.79,
  EUR: 0.92,
  CAD: 1.36,
  AUD: 1.52,
};

/** Converts a USD amount into the target currency using stored/fallback rates. */
export function convertFromUsd(
  usdAmount: number,
  target: string,
  rates: Record<string, number> = FALLBACK_RATES
) {
  const code = normalizeCurrency(target);
  const rate = rates[code] ?? FALLBACK_RATES[code] ?? 1;
  return usdAmount * rate;
}

export function convert(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number> = FALLBACK_RATES
) {
  const fromRate = rates[normalizeCurrency(from)] ?? 1;
  const toRate = rates[normalizeCurrency(to)] ?? 1;
  if (!fromRate) return amount;
  return (amount / fromRate) * toRate;
}

/** Countries offered in the signup form, grouped by billing currency. */
export const SIGNUP_COUNTRIES: { code: string; name: string; currency: CurrencyCode }[] = [
  { code: 'US', name: 'United States', currency: 'USD' },
  { code: 'GB', name: 'United Kingdom', currency: 'GBP' },
  { code: 'CA', name: 'Canada', currency: 'CAD' },
  { code: 'AU', name: 'Australia', currency: 'AUD' },
  { code: 'NZ', name: 'New Zealand', currency: 'AUD' },
  { code: 'IE', name: 'Ireland', currency: 'EUR' },
  { code: 'DE', name: 'Germany', currency: 'EUR' },
  { code: 'FR', name: 'France', currency: 'EUR' },
  { code: 'IT', name: 'Italy', currency: 'EUR' },
  { code: 'ES', name: 'Spain', currency: 'EUR' },
  { code: 'NL', name: 'Netherlands', currency: 'EUR' },
  { code: 'BE', name: 'Belgium', currency: 'EUR' },
  { code: 'AT', name: 'Austria', currency: 'EUR' },
  { code: 'PT', name: 'Portugal', currency: 'EUR' },
  { code: 'FI', name: 'Finland', currency: 'EUR' },
  { code: 'GR', name: 'Greece', currency: 'EUR' },
  { code: 'LU', name: 'Luxembourg', currency: 'EUR' },
  { code: 'MT', name: 'Malta', currency: 'EUR' },
  { code: 'CY', name: 'Cyprus', currency: 'EUR' },
  { code: 'HR', name: 'Croatia', currency: 'EUR' },
  { code: 'SI', name: 'Slovenia', currency: 'EUR' },
  { code: 'SK', name: 'Slovakia', currency: 'EUR' },
  { code: 'EE', name: 'Estonia', currency: 'EUR' },
  { code: 'LV', name: 'Latvia', currency: 'EUR' },
  { code: 'LT', name: 'Lithuania', currency: 'EUR' },
  { code: 'CH', name: 'Switzerland', currency: 'EUR' },
  { code: 'NO', name: 'Norway', currency: 'EUR' },
  { code: 'SE', name: 'Sweden', currency: 'EUR' },
  { code: 'DK', name: 'Denmark', currency: 'EUR' },
  { code: 'IS', name: 'Iceland', currency: 'EUR' },
  { code: 'PL', name: 'Poland', currency: 'EUR' },
  { code: 'CZ', name: 'Czechia', currency: 'EUR' },
  { code: 'HU', name: 'Hungary', currency: 'EUR' },
  { code: 'RO', name: 'Romania', currency: 'EUR' },
  { code: 'BG', name: 'Bulgaria', currency: 'EUR' },
  { code: 'SG', name: 'Singapore', currency: 'USD' },
  { code: 'AE', name: 'United Arab Emirates', currency: 'USD' },
  { code: 'ZA', name: 'South Africa', currency: 'USD' },
  { code: 'IN', name: 'India', currency: 'USD' },
  { code: 'JP', name: 'Japan', currency: 'USD' },
  { code: 'OTHER', name: 'Other country', currency: 'USD' },
];
