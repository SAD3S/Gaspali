import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { freshnessPalettes, palettes, type ColorScheme, type Palette } from './tokens';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeValue {
  scheme: ColorScheme;
  colors: Palette;
  freshness: (typeof freshnessPalettes)[ColorScheme];
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
}

const STORAGE_KEY = 'gaspalli.theme';
const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [preference, setPref] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => {
        if (v === 'light' || v === 'dark' || v === 'system') setPref(v);
      })
      .catch(() => {});
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
    return {
      scheme,
      colors: palettes[scheme],
      freshness: freshnessPalettes[scheme],
      preference,
      setPreference: (p) => {
        setPref(p);
        AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
      },
    };
  }, [preference, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans <ThemeProvider>');
  return ctx;
}
