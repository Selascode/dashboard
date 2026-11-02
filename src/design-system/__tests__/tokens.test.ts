import { describe, expect, it } from 'vitest';
import {
  BUILTIN_PALETTES,
  DEFAULT_PALETTE,
  ThemeTokenName,
  deriveBasePaletteTokens,
  derivePaletteTokens,
  getCategoryBadgeBackgroundHex,
  getContrastRatio,
  rgbToHsl,
  hexToRgb,
} from '../tokens';

const hx = (code: string) => `#${code}`;

describe('Design System — Tokens & Moteur de Palettes Dynamiques (Section 2, ACC-2)', () => {
  it('reproduit exactement les valeurs de référence de la palette par défaut « Coolors Classic »', () => {
    const base = deriveBasePaletteTokens(DEFAULT_PALETTE);

    // Mode clair (défaut)
    expect(base.light['--bg-canvas']).toBe(hx('F0EBD8'));
    expect(base.light['--bg-surface']).toBe(hx('FAF8F2'));
    expect(base.light['--bg-surface-muted']).toBe(hx('E6DFC8'));
    expect(base.light['--text-primary']).toBe(hx('0D1321'));
    expect(base.light['--text-secondary']).toBe(hx('3E5C76'));
    expect(base.light['--text-muted']).toBe(hx('748CAB'));
    expect(base.light['--accent-primary']).toBe(hx('0D1321'));
    expect(base.light['--accent-foreground']).toBe(hx('F0EBD8'));

    // Mode sombre
    expect(base.dark['--bg-canvas']).toBe(hx('0D1321'));
    expect(base.dark['--bg-surface']).toBe(hx('1D2D44'));
    expect(base.dark['--bg-surface-muted']).toBe(hx('152033'));
    expect(base.dark['--text-primary']).toBe(hx('F0EBD8'));
    expect(base.dark['--text-secondary']).toBe(hx('748CAB'));
    expect(base.dark['--text-muted']).toBe(hx('3E5C76'));
    expect(base.dark['--accent-primary']).toBe(hx('F0EBD8'));
    expect(base.dark['--accent-foreground']).toBe(hx('0D1321'));
  });

  it('corrige text-muted et text-secondary dans la même teinte et garantit un contraste WCAG AA (>= 4.5:1) sur chaque paire texte/fond en clair et en sombre [ACC-2]', () => {
    for (const palette of BUILTIN_PALETTES) {
      const base = deriveBasePaletteTokens(palette);
      const derived = derivePaletteTokens(palette);

      const textTokens: ThemeTokenName[] = [
        '--text-primary',
        '--text-secondary',
        '--text-muted',
        '--danger',
      ];
      const bgTokens: ThemeTokenName[] = [
        '--bg-canvas',
        '--bg-surface',
        '--bg-surface-muted',
      ];

      for (const mode of ['light', 'dark'] as const) {
        for (const textKey of textTokens) {
          for (const bgKey of bgTokens) {
            const fg = derived[mode][textKey];
            const bg = derived[mode][bgKey];
            const ratio = getContrastRatio(fg, bg);
            expect(
              ratio,
              `[${palette.id}/${mode}] ${textKey} (${fg}) sur ${bgKey} (${bg}) = ${ratio.toFixed(2)}:1 (< 4.5:1)`,
            ).toBeGreaterThanOrEqual(4.5);
          }
        }

        // Accent foreground sur accent primary
        const accentRatio = getContrastRatio(
          derived[mode]['--accent-foreground'],
          derived[mode]['--accent-primary'],
        );
        expect(accentRatio).toBeGreaterThanOrEqual(4.5);

        // Vérifier que la teinte (hue) de text-muted et text-secondary est préservée
        for (const key of ['--text-secondary', '--text-muted'] as const) {
          const baseRgb = hexToRgb(base[mode][key]);
          const derivedRgb = hexToRgb(derived[mode][key]);
          const baseHsl = rgbToHsl(baseRgb.r, baseRgb.g, baseRgb.b);
          const derivedHsl = rgbToHsl(derivedRgb.r, derivedRgb.g, derivedRgb.b);
          if (baseHsl.s > 5 && derivedHsl.s > 5) {
            const hueDiff = Math.min(
              Math.abs(baseHsl.h - derivedHsl.h),
              360 - Math.abs(baseHsl.h - derivedHsl.h),
            );
            expect(hueDiff).toBeLessThanOrEqual(6);
          }
        }
      }
    }
  });

  it('garantit un contraste WCAG AA (>= 4.5:1) pour les 8 couleurs de catégories (--cat-1 à --cat-8) sur leurs badges translucides (14% mix)', () => {
    const derived = derivePaletteTokens(DEFAULT_PALETTE);
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

    for (const mode of ['light', 'dark'] as const) {
      const surface = derived[mode]['--bg-surface'];
      for (const catKey of catKeys) {
        const catColor = derived[mode][catKey];
        const badgeBg = getCategoryBadgeBackgroundHex(catColor, surface);
        const ratio = getContrastRatio(catColor, badgeBg);
        expect(
          ratio,
          `[${mode}] ${catKey} (${catColor}) sur badge (${badgeBg}) = ${ratio.toFixed(2)}:1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
