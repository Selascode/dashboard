import { describe, expect, it } from 'vitest';
import { CategoryRecord } from '../db';
import {
  formatDurationShort,
  formatShortDueDateFr,
  parseQuickTaskSyntax,
} from '../quick-parser';

const MOCK_CATEGORIES: CategoryRecord[] = [
  {
    id: 'cat-inbox',
    name: 'Inbox',
    alias: 'inbox',
    color: '--cat-1',
    position: 0,
    is_system: true,
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    deleted_at: null,
    device_id: 'dev-1',
  },
  {
    id: 'cat-ecole',
    name: 'École',
    alias: 'ecole',
    color: '--cat-2',
    position: 1,
    is_system: true,
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    deleted_at: null,
    device_id: 'dev-1',
  },
];

describe('Analyseur de saisie rapide des tâches (CAP-2, TSK-3)', () => {
  it('extrait catégorie, date @auj/@demain, priorité !1..3, durée ~45m et étoile Focus *', () => {
    const parsed = parseQuickTaskSyntax(
      'Rendre le rapport #ecole @demain !3 ~45m *',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Rendre le rapport');
    expect(parsed.categoryId).toBe('cat-ecole');
    expect(parsed.categoryName).toBe('École');
    expect(parsed.dueDate).toBe('2026-11-03');
    expect(parsed.priority).toBe(3);
    expect(parsed.estimatedMinutes).toBe(45);
    expect(parsed.addToFocus).toBe(true);
  });

  it('supporte les durées en heures et minutes (~1h30) et les dates ISO (@2026-11-15)', () => {
    const parsed = parseQuickTaskSyntax(
      'Réviser chapitre 4 @2026-11-15 ~1h30 !2',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Réviser chapitre 4');
    expect(parsed.dueDate).toBe('2026-11-15');
    expect(parsed.estimatedMinutes).toBe(90);
    expect(parsed.priority).toBe(2);
    expect(parsed.addToFocus).toBe(false);
  });

  it('formate correctement les durées et les dates courtes en français', () => {
    expect(formatDurationShort(null)).toBeNull();
    expect(formatDurationShort(45)).toBe('45 min');
    expect(formatDurationShort(60)).toBe('1 h');
    expect(formatDurationShort(90)).toBe('1 h 30');

    expect(
      formatShortDueDateFr('2026-11-02', '2026-11-02', {
        today: "Aujourd'hui",
        toPlan: 'À planifier',
      }),
    ).toBe("Aujourd'hui");
    expect(
      formatShortDueDateFr(null, '2026-11-02', {
        today: "Aujourd'hui",
        toPlan: 'À planifier',
      }),
    ).toBe('À planifier');
  });
});
