import fr from './fr.json';

export type TranslationDictionary = typeof fr;

export const translations: Record<'fr', TranslationDictionary> = {
  fr,
};

export function useTranslations(): TranslationDictionary {
  return translations.fr;
}

export { fr };
