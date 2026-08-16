'use client';

import { ThemeProvider } from 'next-themes';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { SettingsMap } from '@/lib/settings-utils';

const SettingsContext = createContext<SettingsMap>({});

export function useSettings() {
  return useContext(SettingsContext);
}

export function Providers({
  children,
  settings,
}: {
  children: ReactNode;
  settings: SettingsMap;
}) {
  const value = useMemo(() => settings, [settings]);

  return (
    <SettingsContext.Provider value={value}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </SettingsContext.Provider>
  );
}
