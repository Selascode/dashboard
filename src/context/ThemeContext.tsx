import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  BUILTIN_PALETTES,
  DEFAULT_PALETTE,
  DerivedPaletteTokens,
  THEME_CACHE_STORAGE_KEY,
  derivePaletteTokens,
  findPaletteById,
} from '../design-system/tokens';
import {
  ColorPalette,
  DateFormat,
  ThemeMode,
  getSettingValue,
  setSettingValue,
  updateSettings,
} from '../lib/db';

interface ThemeCachePayload {
  mode: ThemeMode;
  paletteId: string;
  tokens: DerivedPaletteTokens;
}

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => Promise<void>;
  activePaletteId: string;
  setActivePaletteId: (paletteId: string) => Promise<void>;
  palettes: ColorPalette[];
  customPalettes: ColorPalette[];
  setCustomPalettes: (palettes: ColorPalette[]) => Promise<void>;
  userName: string;
  setUserName: (name: string) => Promise<void>;
  dateFormat: DateFormat;
  setDateFormat: (format: DateFormat) => Promise<void>;
  quickCapturePanelCollapsed: boolean;
  setQuickCapturePanelCollapsed: (collapsed: boolean) => Promise<void>;
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

function applyThemeAndTokensToDocument(
  resolved: 'light' | 'dark',
  mode: ThemeMode,
  palette: ColorPalette,
): DerivedPaletteTokens {
  const derived = derivePaletteTokens(palette);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    if (resolved === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    root.setAttribute('data-palette', palette.id);

    const tokenMap = derived[resolved];
    for (const [key, value] of Object.entries(tokenMap)) {
      root.style.setProperty(key, value);
    }
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const payload: ThemeCachePayload = {
        mode,
        paletteId: palette.id,
        tokens: derived,
      };
      window.localStorage.setItem(
        THEME_CACHE_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // Ignorer erreurs localStorage
    }
  }

  return derived;
}

function getQueryThemeOverride(): ThemeMode | null {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }
  const param = new URLSearchParams(window.location.search).get('theme');
  if (param === 'light' || param === 'dark' || param === 'system') {
    return param;
  }
  return null;
}

function readInitialCachedTheme(): {
  mode: ThemeMode;
  paletteId: string;
} {
  const queryOverride = getQueryThemeOverride();
  if (queryOverride) {
    return {
      mode: queryOverride,
      paletteId: DEFAULT_PALETTE.id,
    };
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(THEME_CACHE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<ThemeCachePayload>;
        const mode: ThemeMode =
          parsed.mode === 'light' || parsed.mode === 'dark' || parsed.mode === 'system'
            ? parsed.mode
            : 'system';
        return {
          mode,
          paletteId: parsed.paletteId || DEFAULT_PALETTE.id,
        };
      }
    } catch {
      // ignore
    }
  }
  return {
    mode: 'system',
    paletteId: DEFAULT_PALETTE.id,
  };
}

/**
 * Applique immédiatement les tokens au chargement du module pour garantir zéro flash (< 5 ms).
 */
function bootstrapThemeSync(): void {
  const { mode, paletteId } = readInitialCachedTheme();
  const resolved = resolveThemeMode(mode);
  const palette = findPaletteById(paletteId);
  applyThemeAndTokensToDocument(resolved, mode, palette);
}

bootstrapThemeSync();

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const initialCache = readInitialCachedTheme();
  const [theme, setThemeState] = useState<ThemeMode>(initialCache.mode);
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() =>
    resolveThemeMode(initialCache.mode),
  );
  const [activePaletteId, setActivePaletteIdState] = useState<string>(
    initialCache.paletteId,
  );
  const [customPalettes, setCustomPalettesState] = useState<ColorPalette[]>([]);
  const [userName, setUserNameState] = useState<string>('');
  const [dateFormat, setDateFormatState] = useState<DateFormat>('DD-MM-YYYY');
  const [quickCapturePanelCollapsed, setQuickCapturePanelCollapsedState] =
    useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getSettingValue<ThemeMode>('theme', 'system'),
      getSettingValue<string>('active_palette', DEFAULT_PALETTE.id),
      getSettingValue<ColorPalette[]>('custom_palettes', []),
      getSettingValue<string>('user_name', ''),
      getSettingValue<DateFormat>('date_format', 'DD-MM-YYYY'),
      getSettingValue<boolean>('quick_capture_panel_collapsed', false),
    ])
      .then(
        ([
          storedTheme,
          storedPaletteId,
          storedCustomPalettes,
          storedUserName,
          storedDateFormat,
          storedPanelCollapsed,
        ]) => {
          if (!isMounted) return;
          const queryOverride = getQueryThemeOverride();
          const effectiveTheme = queryOverride ?? storedTheme;
          const validMode: ThemeMode =
            effectiveTheme === 'light' ||
            effectiveTheme === 'dark' ||
            effectiveTheme === 'system'
              ? effectiveTheme
              : 'system';
          const validCustom = Array.isArray(storedCustomPalettes)
            ? storedCustomPalettes
            : [];
          const palette = findPaletteById(
            storedPaletteId || DEFAULT_PALETTE.id,
            validCustom,
          );
          const resolved = resolveThemeMode(validMode);
          const validDateFormat: DateFormat =
            storedDateFormat === 'DD-MM-YYYY' ||
            storedDateFormat === 'YYYY-MM-DD' ||
            storedDateFormat === 'MM-DD-YYYY'
              ? storedDateFormat
              : 'DD-MM-YYYY';

          setThemeState(validMode);
          setResolvedTheme(resolved);
          setActivePaletteIdState(palette.id);
          setCustomPalettesState(validCustom);
          setUserNameState(
            typeof storedUserName === 'string' ? storedUserName : '',
          );
          setDateFormatState(validDateFormat);
          setQuickCapturePanelCollapsedState(Boolean(storedPanelCollapsed));
          applyThemeAndTokensToDocument(resolved, validMode, palette);
        },
      )
      .catch(() => {
        if (!isMounted) return;
        const resolved = resolveThemeMode('system');
        setResolvedTheme(resolved);
        applyThemeAndTokensToDocument(resolved, 'system', DEFAULT_PALETTE);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const resolved = resolveThemeMode(theme);
    const palette = findPaletteById(activePaletteId, customPalettes);
    setResolvedTheme(resolved);
    applyThemeAndTokensToDocument(resolved, theme, palette);

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
      const currentPalette = findPaletteById(activePaletteId, customPalettes);
      setResolvedTheme(nextResolved);
      applyThemeAndTokensToDocument(nextResolved, 'system', currentPalette);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    return undefined;
  }, [theme, activePaletteId, customPalettes]);

  const setTheme = useCallback(
    async (mode: ThemeMode) => {
      setThemeState(mode);
      const resolved = resolveThemeMode(mode);
      const palette = findPaletteById(activePaletteId, customPalettes);
      setResolvedTheme(resolved);
      applyThemeAndTokensToDocument(resolved, mode, palette);
      await setSettingValue<ThemeMode>('theme', mode);
    },
    [activePaletteId, customPalettes],
  );

  const setActivePaletteId = useCallback(
    async (paletteId: string) => {
      const palette = findPaletteById(paletteId, customPalettes);
      setActivePaletteIdState(palette.id);
      const resolved = resolveThemeMode(theme);
      applyThemeAndTokensToDocument(resolved, theme, palette);
      await setSettingValue<string>('active_palette', palette.id);
    },
    [theme, customPalettes],
  );

  const setCustomPalettes = useCallback(
    async (nextCustomPalettes: ColorPalette[]) => {
      setCustomPalettesState(nextCustomPalettes);
      const palette = findPaletteById(activePaletteId, nextCustomPalettes);
      const resolved = resolveThemeMode(theme);
      applyThemeAndTokensToDocument(resolved, theme, palette);
      await setSettingValue<ColorPalette[]>('custom_palettes', nextCustomPalettes);
    },
    [activePaletteId, theme],
  );

  const setUserName = useCallback(async (name: string) => {
    const trimmed = name.trim();
    setUserNameState(trimmed);
    await setSettingValue<string>('user_name', trimmed);
  }, []);

  const setDateFormat = useCallback(async (format: DateFormat) => {
    setDateFormatState(format);
    await updateSettings({ date_format: format });
  }, []);

  const setQuickCapturePanelCollapsed = useCallback(
    async (collapsed: boolean) => {
      setQuickCapturePanelCollapsedState(collapsed);
      await updateSettings({ quick_capture_panel_collapsed: collapsed });
    },
    [],
  );

  const palettes = [...BUILTIN_PALETTES, ...customPalettes];

  return (
    <ThemeContext.Provider
      value={{
        theme,
        resolvedTheme,
        setTheme,
        activePaletteId,
        setActivePaletteId,
        palettes,
        customPalettes,
        setCustomPalettes,
        userName,
        setUserName,
        dateFormat,
        setDateFormat,
        quickCapturePanelCollapsed,
        setQuickCapturePanelCollapsed,
      }}
    >
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
