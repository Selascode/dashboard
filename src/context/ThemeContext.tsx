import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getSettingValue, setSettingValue, ThemeMode } from '../lib/db';

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemDarkPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return getSystemDarkPreference() ? 'dark' : 'light';
  }
  return mode;
}

function applyThemeToDocument(resolved: 'light' | 'dark', mode: ThemeMode): void {
  if (typeof document === 'undefined') {
    return;
  }
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-theme-mode', mode);
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveThemeMode('system'),
  );

  useEffect(() => {
    let isMounted = true;
    getSettingValue<ThemeMode>('theme', 'system')
      .then((storedMode) => {
        if (!isMounted) return;
        const validMode: ThemeMode =
          storedMode === 'light' || storedMode === 'dark' || storedMode === 'system'
            ? storedMode
            : 'system';
        setThemeState(validMode);
        const resolved = resolveThemeMode(validMode);
        setResolvedTheme(resolved);
        applyThemeToDocument(resolved, validMode);
      })
      .catch(() => {
        if (!isMounted) return;
        const resolved = resolveThemeMode('system');
        setResolvedTheme(resolved);
        applyThemeToDocument(resolved, 'system');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const resolved = resolveThemeMode(theme);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved, theme);

    if (
      theme !== 'system' ||
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      const nextResolved = event.matches ? 'dark' : 'light';
      setResolvedTheme(nextResolved);
      applyThemeToDocument(nextResolved, 'system');
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    return undefined;
  }, [theme]);

  const setTheme = useCallback(async (mode: ThemeMode) => {
    setThemeState(mode);
    const resolved = resolveThemeMode(mode);
    setResolvedTheme(resolved);
    applyThemeToDocument(resolved, mode);
    await setSettingValue<ThemeMode>('theme', mode);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
