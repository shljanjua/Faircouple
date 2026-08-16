'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/components/providers';
import { settingBool } from '@/lib/settings-utils';

const STORAGE_KEY = 'fc_cookie_consent';

export function CookieBanner() {
  const settings = useSettings();
  const enabled = settingBool(settings, 'cookie_banner_enabled', true);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      // Storage blocked — do not nag.
    }
  }, [enabled]);

  const decide = (value: 'all' | 'essential') => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
      (window as any).gtag('consent', 'update', {
        ad_storage: value === 'all' ? 'granted' : 'denied',
        ad_user_data: value === 'all' ? 'granted' : 'denied',
        ad_personalization: value === 'all' ? 'granted' : 'denied',
        analytics_storage: value === 'all' ? 'granted' : 'denied',
      });
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="no-print fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-3xl rounded-xl border border-border bg-card p-4 shadow-lg sm:inset-x-6 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <Cookie className="hidden h-6 w-6 shrink-0 text-primary sm:block" aria-hidden />
        <p className="flex-1 text-sm text-muted-foreground">
          We use essential cookies to keep you signed in, and optional analytics and marketing
          cookies to improve FairCouples. Read our{' '}
          <Link href="/cookie-policy" className="font-medium text-primary underline underline-offset-2">
            cookie policy
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decide('essential')}>
            Essential only
          </Button>
          <Button size="sm" onClick={() => decide('all')}>
            Accept all
          </Button>
        </div>
      </div>
    </div>
  );
}
