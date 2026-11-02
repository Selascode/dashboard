import fr from './fr.json';

export type TranslationDictionary = typeof fr;

export const translations: Record<'fr', TranslationDictionary> = {
  fr,
};

export function useTranslations(): TranslationDictionary {
  return translations.fr;
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

export { fr };
