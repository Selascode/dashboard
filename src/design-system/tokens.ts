import { ColorPalette } from '../lib/db';

export type ThemeTokenName =
  | '--bg-canvas'
  | '--bg-surface'
  | '--bg-surface-muted'
  | '--text-primary'
  | '--text-secondary'
  | '--text-muted'
  | '--accent-primary'
  | '--accent-foreground'
  | '--border-subtle'
  | '--danger'
  | '--focus-ring'
  | '--cat-1'
  | '--cat-2'
  | '--cat-3'
  | '--cat-4'
  | '--cat-5'
  | '--cat-6'
  | '--cat-7'
  | '--cat-8';

export type ThemeTokenMap = Record<ThemeTokenName, string>;

export interface DerivedPaletteTokens {
  light: ThemeTokenMap;
  dark: ThemeTokenMap;
}

export const THEME_CACHE_STORAGE_KEY = 'focus_theme_cache_v1';

export const DEFAULT_PALETTE: ColorPalette = {
  id: 'coolors-classic',
  name: 'Coolors Classic',
  colors: {
    darkest: '#0D1321',
    dark: '#1D2D44',
    mid: '#3E5C76',
    light: '#748CAB',
    lightest: '#F0EBD8',
  },
  overrides: {
    light: {
      '--bg-surface': '#FAF8F2',
      '--bg-surface-muted': '#E6DFC8',
    },
    dark: {
      '--bg-surface-muted': '#152033',
    },
  },
};

export const BUILTIN_PALETTES: ColorPalette[] = [
  DEFAULT_PALETTE,
  {
    id: 'sage-atelier',
    name: 'Atelier Sauge',
    colors: {
      darkest: '#121C17',
      dark: '#1F3028',
      mid: '#3D5A4C',
      light: '#789A89',
      lightest: '#EFECE4',
    },
  },
  {
    id: 'terracotta-ink',
    name: 'Encre & Terre',
    colors: {
      darkest: '#1B1412',
      dark: '#2F221F',
      mid: '#634136',
      light: '#9E7365',
      lightest: '#F3EAE4',
    },
  },
];

const BASE_CATEGORY_SEEDS = {
  light: [
    '#3E5C76', // --cat-1 Inbox
    '#2B5070', // --cat-2 École
    '#2A6049', // --cat-3 Sport
    '#7A5420', // --cat-4 Perso
    '#59417A', // --cat-5 Projets
    '#7C3A4D', // --cat-6
    '#255E69', // --cat-7
    '#4A5568', // --cat-8
  ],
  dark: [
    '#A8BED6', // --cat-1 Inbox
    '#8EB8E5', // --cat-2 École
    '#7FD1AE', // --cat-3 Sport
    '#E8B878', // --cat-4 Perso
    '#C4AEE8', // --cat-5 Projets
    '#E8A5B8', // --cat-6
    '#82CEDB', // --cat-7
    '#B8C4D4', // --cat-8
  ],
};

const BASE_DANGER = {
  light: '#B42318',
  dark: '#FDA29B',
};

const WHITE_HEX = '#FFFFFF';
const BLACK_HEX = '#000000';

export function normalizeHex(hex: string): string {
  const clean = hex.trim().replace(/^#/, '');
  if (clean.length === 3) {
    return (
      '#' +
      clean
        .split('')
        .map((c) => c + c)
        .join('')
        .toUpperCase()
    );
  }
  return '#' + clean.toUpperCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const norm = normalizeHex(hex).slice(1);
  const num = parseInt(norm, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const toHex = (n: number) => clamp(n).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Mélange deux couleurs hexadécimales en sRGB (équivalent de `color-mix(in srgb, colorA weightA, colorB)`).
 */
export function mixHexColors(
  colorA: string,
  colorB: string,
  weightA: number,
): string {
  const w = Math.max(0, Math.min(1, weightA));
  const a = hexToRgb(colorA);
  const b = hexToRgb(colorB);
  return rgbToHex(
    a.r * w + b.r * (1 - w),
    a.g * w + b.g * (1 - w),
    a.b * w + b.b * (1 - w),
  );
}

export function rgbToHsl(
  r: number,
  g: number,
  b: number,
): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb(
  h: number,
  s: number,
  l: number,
): { r: number; g: number; b: number } {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;

  if (sn === 0) {
    const val = Math.round(ln * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;

  return {
    r: Math.round(hue2rgb(p, q, hn + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, hn) * 255),
    b: Math.round(hue2rgb(p, q, hn - 1 / 3) * 255),
  };
}

export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const transform = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = transform(r);
  const G = transform(g);
  const B = transform(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Ajuste la luminosité d'une couleur en conservant strictement sa teinte (H) et sa saturation (S)
 * pour garantir un contraste >= minRatio (4.5:1 par défaut, niveau WCAG AA) sur tous les fonds fournis.
 */
export function ensureAAContrastInHue(
  fgHex: string,
  bgHexes: string[],
  minRatio = 4.5,
  direction?: 'darken' | 'lighten',
): string {
  const checkAll = (candidate: string) =>
    bgHexes.every((bg) => getContrastRatio(candidate, bg) >= minRatio);

  const normalizedFg = normalizeHex(fgHex);
  if (checkAll(normalizedFg)) {
    return normalizedFg;
  }

  const { r, g, b } = hexToRgb(normalizedFg);
  const { h, s, l } = rgbToHsl(r, g, b);

  const avgBgLum =
    bgHexes.reduce((acc, bg) => acc + getRelativeLuminance(bg), 0) /
    Math.max(1, bgHexes.length);
  const dir = direction ?? (avgBgLum > 0.35 ? 'darken' : 'lighten');

  if (dir === 'darken') {
    for (let nextL = l; nextL >= 0; nextL -= 0.5) {
      const rgb = hslToRgb(h, s, nextL);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      if (checkAll(hex)) {
        return hex;
      }
    }
    return BLACK_HEX;
  } else {
    for (let nextL = l; nextL <= 100; nextL += 0.5) {
      const rgb = hslToRgb(h, s, nextL);
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b);
      if (checkAll(hex)) {
        return hex;
      }
    }
    return WHITE_HEX;
  }
}

/**
 * Fonction pure de dérivation produisant les tokens de base à partir des 5 couleurs d'une palette.
 * Reproduit exactement les valeurs de référence de la section 2 pour la palette par défaut.
 */
export function deriveBasePaletteTokens(
  palette: ColorPalette,
): DerivedPaletteTokens {
  const darkest = normalizeHex(palette.colors.darkest);
  const dark = normalizeHex(palette.colors.dark);
  const mid = normalizeHex(palette.colors.mid);
  const light = normalizeHex(palette.colors.light);
  const lightest = normalizeHex(palette.colors.lightest);

  const defaultLightSurface = mixHexColors(lightest, WHITE_HEX, 0.34);
  const defaultLightSurfaceMuted = mixHexColors(lightest, dark, 0.93);
  const defaultDarkSurfaceMuted = mixHexColors(darkest, dark, 0.5);

  const lightSurface = normalizeHex(
    palette.overrides?.light?.['--bg-surface'] ?? defaultLightSurface,
  );
  const lightSurfaceMuted = normalizeHex(
    palette.overrides?.light?.['--bg-surface-muted'] ?? defaultLightSurfaceMuted,
  );
  const darkSurfaceMuted = normalizeHex(
    palette.overrides?.dark?.['--bg-surface-muted'] ?? defaultDarkSurfaceMuted,
  );

  const lightBorderSubtle = mixHexColors(darkest, lightest, 0.22);
  const darkBorderSubtle = mixHexColors(lightest, dark, 0.25);

  const lightTokens: ThemeTokenMap = {
    '--bg-canvas': lightest,
    '--bg-surface': lightSurface,
    '--bg-surface-muted': lightSurfaceMuted,
    '--text-primary': darkest,
    '--text-secondary': mid,
    '--text-muted': light,
    '--accent-primary': darkest,
    '--accent-foreground': lightest,
    '--border-subtle': lightBorderSubtle,
    '--danger': BASE_DANGER.light,
    '--focus-ring': mid,
    '--cat-1': BASE_CATEGORY_SEEDS.light[0],
    '--cat-2': BASE_CATEGORY_SEEDS.light[1],
    '--cat-3': BASE_CATEGORY_SEEDS.light[2],
    '--cat-4': BASE_CATEGORY_SEEDS.light[3],
    '--cat-5': BASE_CATEGORY_SEEDS.light[4],
    '--cat-6': BASE_CATEGORY_SEEDS.light[5],
    '--cat-7': BASE_CATEGORY_SEEDS.light[6],
    '--cat-8': BASE_CATEGORY_SEEDS.light[7],
  };

  const darkTokens: ThemeTokenMap = {
    '--bg-canvas': darkest,
    '--bg-surface': dark,
    '--bg-surface-muted': darkSurfaceMuted,
    '--text-primary': lightest,
    '--text-secondary': light,
    '--text-muted': mid,
    '--accent-primary': lightest,
    '--accent-foreground': darkest,
    '--border-subtle': darkBorderSubtle,
    '--danger': BASE_DANGER.dark,
    '--focus-ring': light,
    '--cat-1': BASE_CATEGORY_SEEDS.dark[0],
    '--cat-2': BASE_CATEGORY_SEEDS.dark[1],
    '--cat-3': BASE_CATEGORY_SEEDS.dark[2],
    '--cat-4': BASE_CATEGORY_SEEDS.dark[3],
    '--cat-5': BASE_CATEGORY_SEEDS.dark[4],
    '--cat-6': BASE_CATEGORY_SEEDS.dark[5],
    '--cat-7': BASE_CATEGORY_SEEDS.dark[6],
    '--cat-8': BASE_CATEGORY_SEEDS.dark[7],
  };

  return {
    light: lightTokens,
    dark: darkTokens,
  };
}

/**
 * Fonction pure de dérivation avec garantie de contraste WCAG AA (>= 4.5:1)
 * sur toutes les paires texte/fond et sur tous les badges de catégories translucides (14% mix).
 */
export function derivePaletteTokens(
  palette: ColorPalette,
): DerivedPaletteTokens {
  const base = deriveBasePaletteTokens(palette);

  const lightBgs = [
    base.light['--bg-canvas'],
    base.light['--bg-surface'],
    base.light['--bg-surface-muted'],
  ];
  const darkBgs = [
    base.dark['--bg-canvas'],
    base.dark['--bg-surface'],
    base.dark['--bg-surface-muted'],
  ];

  const lightTokens: ThemeTokenMap = {
    ...base.light,
    '--text-primary': ensureAAContrastInHue(
      base.light['--text-primary'],
      lightBgs,
      4.5,
      'darken',
    ),
    '--text-secondary': ensureAAContrastInHue(
      base.light['--text-secondary'],
      lightBgs,
      4.5,
      'darken',
    ),
    '--text-muted': ensureAAContrastInHue(
      base.light['--text-muted'],
      lightBgs,
      4.5,
      'darken',
    ),
    '--accent-foreground': ensureAAContrastInHue(
      base.light['--accent-foreground'],
      [base.light['--accent-primary']],
      4.5,
    ),
    '--danger': ensureAAContrastInHue(
      base.light['--danger'],
      lightBgs,
      4.5,
      'darken',
    ),
  };

  const darkTokens: ThemeTokenMap = {
    ...base.dark,
    '--text-primary': ensureAAContrastInHue(
      base.dark['--text-primary'],
      darkBgs,
      4.5,
      'lighten',
    ),
    '--text-secondary': ensureAAContrastInHue(
      base.dark['--text-secondary'],
      darkBgs,
      4.5,
      'lighten',
    ),
    '--text-muted': ensureAAContrastInHue(
      base.dark['--text-muted'],
      darkBgs,
      4.5,
      'lighten',
    ),
    '--accent-foreground': ensureAAContrastInHue(
      base.dark['--accent-foreground'],
      [base.dark['--accent-primary']],
      4.5,
    ),
    '--danger': ensureAAContrastInHue(
      base.dark['--danger'],
      darkBgs,
      4.5,
      'lighten',
    ),
  };

  // Garantir le contraste AA (>= 4.5:1) pour chaque catégorie (--cat-1 à --cat-8)
  // sur son fond de badge `color-mix(in srgb, var(--cat-n) 14%, var(--bg-surface))` ainsi que sur les surfaces.
  const catKeys: ThemeTokenName[] = [
    '--cat-1',
    '--cat-2',
    '--cat-3',
    '--cat-4',
    '--cat-5',
    '--cat-6',
    '--cat-7',
    '--cat-8',
  ];

  for (const key of catKeys) {
    const rawLightCat = lightTokens[key];
    const lightBadgeBg = mixHexColors(
      rawLightCat,
      lightTokens['--bg-surface'],
      0.14,
    );
    lightTokens[key] = ensureAAContrastInHue(
      rawLightCat,
      [lightBadgeBg, ...lightBgs],
      4.5,
      'darken',
    );

    const rawDarkCat = darkTokens[key];
    const darkBadgeBg = mixHexColors(
      rawDarkCat,
      darkTokens['--bg-surface'],
      0.14,
    );
    darkTokens[key] = ensureAAContrastInHue(
      rawDarkCat,
      [darkBadgeBg, ...darkBgs],
      4.5,
      'lighten',
    );
  }

  return {
    light: lightTokens,
    dark: darkTokens,
  };
}

export function getCategoryBadgeBackgroundHex(
  catColorHex: string,
  surfaceHex: string,
): string {
  return mixHexColors(catColorHex, surfaceHex, 0.14);
}

export function findPaletteById(
  paletteId: string,
  customPalettes: ColorPalette[] = [],
): ColorPalette {
  const all = [...BUILTIN_PALETTES, ...customPalettes];
  return all.find((p) => p.id === paletteId) ?? DEFAULT_PALETTE;
}
