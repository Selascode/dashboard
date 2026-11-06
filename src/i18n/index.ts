import en from './en.json';
import fr from './fr.json';

export type TranslationDictionary = typeof fr;

export const translations: Record<'fr' | 'en', TranslationDictionary> = {
  fr,
  en,
};

export function useTranslations(locale: 'fr' | 'en' = 'fr'): TranslationDictionary {
  return translations[locale] ?? translations.fr;
}

export function formatTranslation(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val)),
    template,
  );
}

export { fr, en };
