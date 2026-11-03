import { CategoryRecord, DateFormat, DateFormatPreference } from './db';

export type { DateFormatPreference };

export interface QuickParseOptions {
  now?: Date | string;
  referenceToday?: Date | string;
  dateFormat?: DateFormatPreference;
}

export interface ParsedQuickTask {
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  ambiguousCategories?: CategoryRecord[];
  unknownCategoryToken?: string | null;
  dueDate: string | null;
  hasDueTime?: boolean;
  dueTime?: string | null;
  priority: number;
  estimatedMinutes: number | null;
  addToFocus: boolean;
}

export interface TemporalLocaleDictionary {
  today: string[];
  tomorrow: string[];
  relativeDayPattern: RegExp;
  weekdays: Record<string, number>;
}

export const TEMPORAL_KEYWORDS: Record<'fr' | 'en', TemporalLocaleDictionary> = {
  fr: {
    today: ['auj', 'aujourdhui', "aujourd'hui", 'aujourd’hui'],
    tomorrow: ['demain', 'dem'],
    relativeDayPattern: /^\+(\d+)j?$/i,
    weekdays: {
      dim: 0,
      dimanche: 0,
      lun: 1,
      lundi: 1,
      mar: 2,
      mardi: 2,
      mer: 3,
      mercredi: 3,
      jeu: 4,
      jeudi: 4,
      ven: 5,
      vendredi: 5,
      sam: 6,
      samedi: 6,
    },
  },
  en: {
    today: ['today', 'tod'],
    tomorrow: ['tomorrow', 'tmr', 'tom'],
    relativeDayPattern: /^\+(\d+)d?$/i,
    weekdays: {
      sun: 0,
      sunday: 0,
      mon: 1,
      monday: 1,
      tue: 2,
      tues: 2,
      tuesday: 2,
      wed: 3,
      wednesday: 3,
      thu: 4,
      thur: 4,
      thurs: 4,
      thursday: 4,
      fri: 5,
      friday: 5,
      sat: 6,
      saturday: 6,
    },
  },
};

const ESCAPED_HASH_PLACEHOLDER = '\u0000ESCAPED_HASH\u0000';

function normalizeToken(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeReferenceDate(referenceToday?: string | Date): string {
  if (!referenceToday) {
    return '2026-11-02';
  }
  if (referenceToday instanceof Date) {
    if (Number.isNaN(referenceToday.getTime())) {
      return '2026-11-02';
    }
    return referenceToday.toISOString().slice(0, 10);
  }
  const trimmed = referenceToday.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return '2026-11-02';
}

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1000 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return false;
  }
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function formatIsoDateParts(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getDateFormatPlaceholder(
  dateFormat: DateFormat = 'DD-MM-YYYY',
): string {
  switch (dateFormat) {
    case 'MM-DD-YYYY':
      return 'MM-JJ-AAAA';
    case 'YYYY-MM-DD':
      return 'AAAA-MM-JJ';
    case 'DD-MM-YYYY':
    default:
      return 'JJ-MM-AAAA';
  }
}

export function formatDateByPreference(
  isoDate: string | null | undefined,
  dateFormat: DateFormat = 'DD-MM-YYYY',
): string {
  if (!isoDate) {
    return '';
  }
  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return isoDate;
  }
  const [, yyyy, mm, dd] = match;
  switch (dateFormat) {
    case 'MM-DD-YYYY':
      return `${mm}-${dd}-${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD-MM-YYYY':
    default:
      return `${dd}-${mm}-${yyyy}`;
  }
}

export function parseDateByPreference(
  input: string,
  dateFormat: DateFormat = 'DD-MM-YYYY',
  referenceYear = 2026,
): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  // 1. Format avec année en premier : YYYY-MM-DD ou YYYY/MM/DD
  const yearFirstMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yearFirstMatch) {
    const year = Number(yearFirstMatch[1]);
    const month = Number(yearFirstMatch[2]);
    const day = Number(yearFirstMatch[3]);
    if (!isValidCalendarDate(year, month, day)) {
      return null;
    }
    return formatIsoDateParts(year, month, day);
  }

  // 2. Format complet avec année en dernier : JJ/MM/AAAA, JJ-MM-AAAA, MM/JJ/AAAA, MM-JJ-AAAA
  const yearLastMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (yearLastMatch) {
    const first = Number(yearLastMatch[1]);
    const second = Number(yearLastMatch[2]);
    const year = Number(yearLastMatch[3]);
    let day: number;
    let month: number;

    if (dateFormat === 'MM-DD-YYYY') {
      if (first > 12 && second >= 1 && second <= 12) {
        day = first;
        month = second;
      } else {
        month = first;
        day = second;
      }
    } else {
      day = first;
      month = second;
    }

    if (!isValidCalendarDate(year, month, day)) {
      return null;
    }
    return formatIsoDateParts(year, month, day);
  }

  // 3. Format court sans année : JJ/MM, JJ-MM, MM/JJ, MM-JJ
  const shortMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})$/);
  if (shortMatch) {
    const first = Number(shortMatch[1]);
    const second = Number(shortMatch[2]);
    let day: number;
    let month: number;

    if (dateFormat === 'MM-DD-YYYY') {
      if (first > 12 && second >= 1 && second <= 12) {
        day = first;
        month = second;
      } else {
        month = first;
        day = second;
      }
    } else {
      day = first;
      month = second;
    }

    if (!isValidCalendarDate(referenceYear, month, day)) {
      return null;
    }
    return formatIsoDateParts(referenceYear, month, day);
  }

  return null;
}

function parseTimeToken(rawTime: string): string | null {
  const match = rawTime.trim().match(/^(\d{1,2})(?:h(\d{2})?|h|:(\d{2}))$/i);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? match[3] ?? '0');
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function resolveDateToken(
  token: string,
  referenceIso: string,
  dateFormat: DateFormat,
): string | null {
  const norm = normalizeToken(token);
  const [ry, rm, rd] = referenceIso.split('-').map(Number);
  const refYear = ry || 2026;
  const baseUtc = new Date(
    Date.UTC(refYear, (rm || 11) - 1, rd || 2, 12, 0, 0),
  );

  const dict = TEMPORAL_KEYWORDS.fr;

  if (dict.today.includes(norm)) {
    return referenceIso;
  }

  if (dict.tomorrow.includes(norm)) {
    baseUtc.setUTCDate(baseUtc.getUTCDate() + 1);
    return baseUtc.toISOString().slice(0, 10);
  }

  const plusMatch = norm.match(dict.relativeDayPattern);
  if (plusMatch) {
    const offsetDays = Number(plusMatch[1]);
    baseUtc.setUTCDate(baseUtc.getUTCDate() + offsetDays);
    return baseUtc.toISOString().slice(0, 10);
  }

  if (Object.prototype.hasOwnProperty.call(dict.weekdays, norm)) {
    const targetDow = dict.weekdays[norm];
    const currentDow = baseUtc.getUTCDay();
    let delta = (targetDow - currentDow + 7) % 7;
    if (delta === 0) {
      delta = 7;
    }
    baseUtc.setUTCDate(baseUtc.getUTCDate() + delta);
    return baseUtc.toISOString().slice(0, 10);
  }

  return parseDateByPreference(norm, dateFormat, refYear);
}

export function formatEditorialDateFr(isoDate = '2026-11-02'): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y || 2026, (m || 11) - 1, d || 2);
  const formatted = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export function formatDurationShort(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) {
    return null;
  }
  if (minutes % 60 === 0) {
    return `${minutes / 60} h`;
  }
  if (minutes > 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} h ${m}`;
  }
  return `${minutes} min`;
}

export function formatShortDueDateFr(
  dueDate: string | null,
  referenceToday = '2026-11-02',
  labels: { today: string; toPlan: string },
  dateFormat?: DateFormat,
): string {
  if (!dueDate) {
    return labels.toPlan;
  }
  if (dueDate === referenceToday) {
    return labels.today;
  }
  if (dateFormat) {
    return formatDateByPreference(dueDate, dateFormat);
  }
  const [y, m, d] = dueDate.split('-').map(Number);
  if (!y || !m || !d) {
    return dueDate;
  }
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(date);
}

export function formatDueDateDisplay(
  dueDate: string | null | undefined,
  referenceToday = '2026-11-02',
  labels: { today: string; toPlan: string },
  dateFormat: DateFormat = 'DD-MM-YYYY',
): string {
  if (!dueDate) {
    return labels.toPlan;
  }
  if (dueDate === referenceToday) {
    return labels.today;
  }
  return formatDateByPreference(dueDate, dateFormat);
}

export function getQuickCaptureDateExample(
  dateFormat: DateFormat = 'DD-MM-YYYY',
): string {
  switch (dateFormat) {
    case 'MM-DD-YYYY':
      return '@11-15-2026';
    case 'YYYY-MM-DD':
      return '@2026-11-15';
    case 'DD-MM-YYYY':
    default:
      return '@15-11-2026';
  }
}

function isCategoryRecordArray(val: unknown): val is CategoryRecord[] {
  return Array.isArray(val);
}

export function parseQuickTaskSyntax(
  rawInput: string,
  categoriesOrOptions: CategoryRecord[] | QuickParseOptions | string | Date = [],
  referenceTodayOrOptions: string | Date | QuickParseOptions = '2026-11-02',
  dateFormatArg: DateFormat = 'DD-MM-YYYY',
): ParsedQuickTask {
  let categories: CategoryRecord[] = [];
  let referenceToday: string | Date = '2026-11-02';
  let dateFormat: DateFormat = dateFormatArg;

  if (isCategoryRecordArray(categoriesOrOptions)) {
    categories = categoriesOrOptions;
    if (
      referenceTodayOrOptions &&
      typeof referenceTodayOrOptions === 'object' &&
      !(referenceTodayOrOptions instanceof Date)
    ) {
      referenceToday =
        referenceTodayOrOptions.now ??
        referenceTodayOrOptions.referenceToday ??
        '2026-11-02';
      dateFormat = referenceTodayOrOptions.dateFormat ?? dateFormatArg;
    } else {
      referenceToday = (referenceTodayOrOptions as string | Date) ?? '2026-11-02';
    }
  } else if (
    categoriesOrOptions &&
    typeof categoriesOrOptions === 'object' &&
    !(categoriesOrOptions instanceof Date)
  ) {
    referenceToday =
      categoriesOrOptions.now ??
      categoriesOrOptions.referenceToday ??
      '2026-11-02';
    dateFormat = categoriesOrOptions.dateFormat ?? dateFormatArg;
  } else if (
    typeof categoriesOrOptions === 'string' ||
    categoriesOrOptions instanceof Date
  ) {
    referenceToday = categoriesOrOptions;
  }

  const referenceIso = normalizeReferenceDate(referenceToday);
  const activeCategories = categories.filter((c) => !c.deleted_at);

  // Protéger les dièses échappés (\#) avant l'extraction des jetons
  let working = rawInput.replace(/\\#/g, ESCAPED_HASH_PLACEHOLDER).trim();
  let addToFocus = false;

  if (/(?:^|\s)\*$/.test(working)) {
    addToFocus = true;
    working = working.replace(/(?:^|\s)\*$/, '').trim();
  }

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  let ambiguousCategories: CategoryRecord[] = [];
  let unknownCategoryToken: string | null = null;

  working = working.replace(
    /(?:^|\s)#([\p{L}\p{N}_-]+)/gu,
    (_full, rawCat: string) => {
      const target = normalizeToken(rawCat);
      const exactAlias = activeCategories.find(
        (c) => normalizeToken(c.alias) === target,
      );
      const exactName = activeCategories.find(
        (c) => normalizeToken(c.name) === target,
      );
      const exactMatch = exactAlias ?? exactName;

      if (exactMatch) {
        categoryId = exactMatch.id;
        categoryName = exactMatch.name;
        ambiguousCategories = [];
        unknownCategoryToken = null;
        return ' ';
      }

      const prefixMatches = activeCategories.filter(
        (c) =>
          normalizeToken(c.alias).startsWith(target) ||
          normalizeToken(c.name).startsWith(target),
      );

      if (prefixMatches.length === 1) {
        categoryId = prefixMatches[0].id;
        categoryName = prefixMatches[0].name;
        ambiguousCategories = [];
        unknownCategoryToken = null;
        return ' ';
      }

      if (prefixMatches.length > 1) {
        categoryId = null;
        categoryName = null;
        ambiguousCategories = prefixMatches;
        unknownCategoryToken = null;
        return ' ';
      }

      categoryId = null;
      categoryName = null;
      ambiguousCategories = [];
      unknownCategoryToken = rawCat;
      return ' ';
    },
  );

  let priority = 0;
  working = working.replace(
    /(?:^|\s)!([1-3])(?=\s|$)/g,
    (_full, p: string) => {
      priority = Number(p);
      return ' ';
    },
  );

  let estimatedMinutes: number | null = null;
  working = working.replace(
    /(?:^|\s)~(?:(\d+)h(?:(\d+)(?:m(?:in)?)?)?|(\d+)(?:m(?:in)?)?)(?=\s|$)/gi,
    (_full, h?: string, hm?: string, mOnly?: string) => {
      if (h !== undefined) {
        const total = Number(h) * 60 + (hm ? Number(hm) : 0);
        estimatedMinutes = total > 0 ? total : null;
      } else if (mOnly !== undefined) {
        const total = Number(mOnly);
        estimatedMinutes = total > 0 ? total : null;
      }
      return ' ';
    },
  );

  let dueDate: string | null = null;
  let hasDueTime = false;
  let dueTime: string | null = null;

  working = working.replace(
    /(?:^|\s)@([^\s]+)(?:\s+(\d{1,2}(?:h(?:\d{2})?|:\d{2}))(?=\s|$))?/gi,
    (_full, token: string, rawTime?: string) => {
      const resolvedDate = resolveDateToken(token, referenceIso, dateFormat);
      if (resolvedDate) {
        dueDate = resolvedDate;
        if (rawTime) {
          const parsedTime = parseTimeToken(rawTime);
          if (parsedTime) {
            hasDueTime = true;
            dueTime = parsedTime;
            return ' ';
          }
          hasDueTime = false;
          dueTime = null;
          return ` ${rawTime}`;
        }
        hasDueTime = false;
        dueTime = null;
        return ' ';
      }
      return rawTime ? ` ${rawTime}` : ' ';
    },
  );

  // Permet également `*` placé avant d'autres jetons en fin de saisie
  if (!addToFocus && /(?:^|\s)\*$/.test(working.trim())) {
    addToFocus = true;
    working = working.trim().replace(/(?:^|\s)\*$/, '').trim();
  }

  const restoredWorking = working.replace(
    new RegExp(ESCAPED_HASH_PLACEHOLDER, 'g'),
    '#',
  );
  const cleanTitle = restoredWorking.replace(/\s+/g, ' ').trim();
  const fallbackTitle = rawInput
    .replace(/\\#/g, '#')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title: cleanTitle || fallbackTitle,
    categoryId,
    categoryName,
    ambiguousCategories,
    unknownCategoryToken,
    dueDate,
    hasDueTime,
    dueTime,
    priority,
    estimatedMinutes,
    addToFocus,
  };
}

export const parseQuickCapture = parseQuickTaskSyntax;
