import { CategoryRecord } from './db';

export interface ParsedQuickTask {
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  dueDate: string | null;
  priority: number;
  estimatedMinutes: number | null;
  addToFocus: boolean;
}

function normalizeToken(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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
): string {
  if (!dueDate) {
    return labels.toPlan;
  }
  if (dueDate === referenceToday) {
    return labels.today;
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

export function parseQuickTaskSyntax(
  rawInput: string,
  categories: CategoryRecord[],
  referenceToday = '2026-11-02',
): ParsedQuickTask {
  let working = rawInput.trim();
  let addToFocus = false;

  if (/(?:^|\s)\*$/.test(working)) {
    addToFocus = true;
    working = working.replace(/(?:^|\s)\*$/, '').trim();
  }

  let categoryId: string | null = null;
  let categoryName: string | null = null;
  working = working.replace(/(?:^|\s)#([a-zA-Z0-9À-ÿ_-]+)/g, (full, rawCat: string) => {
    const target = normalizeToken(rawCat);
    const matched =
      categories.find((c) => normalizeToken(c.alias) === target) ??
      categories.find((c) => normalizeToken(c.name) === target) ??
      categories.find((c) => normalizeToken(c.alias).startsWith(target));
    if (matched) {
      categoryId = matched.id;
      categoryName = matched.name;
      return ' ';
    }
    return full;
  });

  let priority = 0;
  working = working.replace(/(?:^|\s)!([1-3])(?=\s|$)/g, (_full, p: string) => {
    priority = Number(p);
    return ' ';
  });

  let estimatedMinutes: number | null = null;
  working = working.replace(
    /(?:^|\s)~(?:(\d+)h(?:(\d+))?|(\d+)m?)(?=\s|$)/gi,
    (_full, h?: string, hm?: string, mOnly?: string) => {
      if (h) {
        estimatedMinutes = Number(h) * 60 + (hm ? Number(hm) : 0);
      } else if (mOnly) {
        estimatedMinutes = Number(mOnly);
      }
      return ' ';
    },
  );

  let dueDate: string | null = null;
  working = working.replace(/(?:^|\s)@([^\s]+)/g, (_full, token: string) => {
    const norm = normalizeToken(token);
    const [ry, rm, rd] = referenceToday.split('-').map(Number);
    const baseUtc = new Date(
      Date.UTC(ry || 2026, (rm || 11) - 1, rd || 2, 12, 0, 0),
    );

    if (norm === 'auj' || norm === 'aujourdhui') {
      dueDate = referenceToday;
      return ' ';
    }
    if (norm === 'demain') {
      baseUtc.setUTCDate(baseUtc.getUTCDate() + 1);
      dueDate = baseUtc.toISOString().slice(0, 10);
      return ' ';
    }
    const plusMatch = norm.match(/^\+(\d+)j$/);
    if (plusMatch) {
      baseUtc.setUTCDate(baseUtc.getUTCDate() + Number(plusMatch[1]));
      dueDate = baseUtc.toISOString().slice(0, 10);
      return ' ';
    }
    const isoMatch = norm.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      dueDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      return ' ';
    }
    const slashMatch = norm.match(/^(\d{1,2})\/(\d{1,2})$/);
    if (slashMatch) {
      const day = String(Number(slashMatch[1])).padStart(2, '0');
      const month = String(Number(slashMatch[2])).padStart(2, '0');
      dueDate = `${ry || 2026}-${month}-${day}`;
      return ' ';
    }
    return ' ';
  });

  const cleanTitle = working.replace(/\s+/g, ' ').trim();

  return {
    title: cleanTitle || rawInput.trim(),
    categoryId,
    categoryName,
    dueDate,
    priority,
    estimatedMinutes,
    addToFocus,
  };
}
