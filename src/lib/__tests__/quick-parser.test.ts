import { describe, expect, it } from 'vitest';
import { CategoryRecord } from '../db';
import {
  formatDateByPreference,
  formatDurationShort,
  formatEditorialDateFr,
  formatShortDueDateFr,
  getDateFormatPlaceholder,
  parseDateByPreference,
  parseQuickCapture,
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
    is_system: false,
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    deleted_at: null,
    device_id: 'dev-1',
  },
  {
    id: 'cat-sport',
    name: 'Sport',
    alias: 'sport',
    color: '--cat-3',
    position: 2,
    is_system: false,
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    deleted_at: null,
    device_id: 'dev-1',
  },
  {
    id: 'cat-perso',
    name: 'Perso',
    alias: 'perso',
    color: '--cat-4',
    position: 3,
    is_system: false,
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    deleted_at: null,
    device_id: 'dev-1',
  },
  {
    id: 'cat-projets',
    name: 'Projets',
    alias: 'projets',
    color: '--cat-5',
    position: 4,
    is_system: false,
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    deleted_at: null,
    device_id: 'dev-1',
  },
];

const AMBIGUOUS_CATEGORIES: CategoryRecord[] = [
  ...MOCK_CATEGORIES,
  {
    id: 'cat-economie',
    name: 'Économie',
    alias: 'economie',
    color: '--cat-2',
    position: 5,
    is_system: false,
    created_at: '2026-11-02T00:00:00Z',
    updated_at: '2026-11-02T00:00:00Z',
    deleted_at: null,
    device_id: 'dev-1',
  },
];

describe('Analyseur de saisie rapide des tâches (CAP-2, CAP-3, QLT-1)', () => {
  // --- 1. Exemple de référence et cas nominaux ---
  it('1. analyse l’exemple complet de référence du cahier des charges (Section 5.1)', () => {
    const parsed = parseQuickCapture(
      'Rendre le TP de SGBD #ecole @ven 18h !3 ~2h *',
      MOCK_CATEGORIES,
      '2026-11-02', // Lundi
    );
    expect(parsed.title).toBe('Rendre le TP de SGBD');
    expect(parsed.categoryId).toBe('cat-ecole');
    expect(parsed.categoryName).toBe('École');
    expect(parsed.dueDate).toBe('2026-11-06');
    expect(parsed.hasDueTime).toBe(true);
    expect(parsed.dueTime).toBe('18:00');
    expect(parsed.priority).toBe(3);
    expect(parsed.estimatedMinutes).toBe(120);
    expect(parsed.addToFocus).toBe(true);
  });

  it('2. extrait catégorie, date @demain, priorité !3, durée ~45m et étoile Focus *', () => {
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

  it('3. retourne les valeurs par défaut lorsqu’aucun jeton n’est présent', () => {
    const parsed = parseQuickTaskSyntax(
      'Acheter du pain en rentrant',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Acheter du pain en rentrant');
    expect(parsed.categoryId).toBeNull();
    expect(parsed.categoryName).toBeNull();
    expect(parsed.dueDate).toBeNull();
    expect(parsed.hasDueTime).toBe(false);
    expect(parsed.dueTime).toBeNull();
    expect(parsed.priority).toBe(0);
    expect(parsed.estimatedMinutes).toBeNull();
    expect(parsed.addToFocus).toBe(false);
  });

  // --- 2. Résolution des catégories (#nom, #alias, accents, préfixes, ambiguïtés, inconnu, \#, tirets) ---
  it('4. résout une catégorie par son nom accentué exact (#École)', () => {
    const parsed = parseQuickTaskSyntax(
      'Préparer exposé #École',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Préparer exposé');
    expect(parsed.categoryId).toBe('cat-ecole');
    expect(parsed.categoryName).toBe('École');
  });

  it('5. résout une catégorie indépendamment de la casse (#ÉCOLE et #SPORT)', () => {
    const p1 = parseQuickTaskSyntax('Cours #ÉCOLE', MOCK_CATEGORIES);
    const p2 = parseQuickTaskSyntax('Footing #SPORT', MOCK_CATEGORIES);
    expect(p1.categoryId).toBe('cat-ecole');
    expect(p2.categoryId).toBe('cat-sport');
  });

  it('6. résout une catégorie par préfixe unique (#eco -> École quand non ambigu)', () => {
    const parsed = parseQuickTaskSyntax(
      'Lire polycopié #eco',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Lire polycopié');
    expect(parsed.categoryId).toBe('cat-ecole');
    expect(parsed.categoryName).toBe('École');
    expect(parsed.ambiguousCategories).toEqual([]);
  });

  it('7. résout une catégorie par préfixe court unique (#sp -> Sport, #proj -> Projets)', () => {
    const p1 = parseQuickTaskSyntax('Gainage #sp', MOCK_CATEGORIES);
    const p2 = parseQuickTaskSyntax('Maquette #proj', MOCK_CATEGORIES);
    expect(p1.categoryId).toBe('cat-sport');
    expect(p2.categoryId).toBe('cat-projets');
  });

  it('8. détecte un préfixe de catégorie ambigu (#eco entre École et Économie) sans bloquer', () => {
    const parsed = parseQuickTaskSyntax(
      'Réviser le cours #eco',
      AMBIGUOUS_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Réviser le cours');
    expect(parsed.categoryId).toBeNull();
    expect(parsed.categoryName).toBeNull();
    expect(parsed.ambiguousCategories).toHaveLength(2);
    expect(parsed.ambiguousCategories?.map((c) => c.id)).toEqual([
      'cat-ecole',
      'cat-economie',
    ]);
    expect(parsed.unknownCategoryToken).toBeNull();
  });

  it('9. privilégie une correspondance exacte d’alias même si une autre catégorie partage ce préfixe', () => {
    const catsWithPrefixOverlap: CategoryRecord[] = [
      ...MOCK_CATEGORIES,
      {
        id: 'cat-pro',
        name: 'Pro',
        alias: 'pro',
        color: '--cat-5',
        position: 6,
        is_system: false,
        created_at: '2026-11-02T00:00:00Z',
        updated_at: '2026-11-02T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-1',
      },
    ];
    const parsed = parseQuickTaskSyntax(
      'Facture client #pro',
      catsWithPrefixOverlap,
    );
    expect(parsed.categoryId).toBe('cat-pro');
    expect(parsed.categoryName).toBe('Pro');
    expect(parsed.ambiguousCategories).toEqual([]);
  });

  it('10. signale une catégorie inconnue (#musique) et nettoie le titre (CAP-3)', () => {
    const parsed = parseQuickTaskSyntax(
      'Accorder la guitare #musique',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Accorder la guitare');
    expect(parsed.categoryId).toBeNull();
    expect(parsed.categoryName).toBeNull();
    expect(parsed.unknownCategoryToken).toBe('musique');
    expect(parsed.ambiguousCategories).toEqual([]);
  });

  it('11. ignore les catégories supprimées logiquement (deleted_at non null)', () => {
    const catsWithDeleted: CategoryRecord[] = [
      ...MOCK_CATEGORIES,
      {
        id: 'cat-archive',
        name: 'Archive',
        alias: 'archive',
        color: '--cat-1',
        position: 7,
        is_system: false,
        created_at: '2026-11-02T00:00:00Z',
        updated_at: '2026-11-02T00:00:00Z',
        deleted_at: '2026-11-02T12:00:00Z',
        device_id: 'dev-1',
      },
    ];
    const parsed = parseQuickTaskSyntax(
      'Vieux dossier #archive',
      catsWithDeleted,
    );
    expect(parsed.categoryId).toBeNull();
    expect(parsed.unknownCategoryToken).toBe('archive');
  });

  it('12. convertit \\# en dièse littéral dans le titre tout en résolvant #categorie', () => {
    const parsed = parseQuickTaskSyntax(
      'Exercice \\#1 #ecole',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Exercice #1');
    expect(parsed.categoryId).toBe('cat-ecole');
    expect(parsed.categoryName).toBe('École');
  });

  it('13. supporte plusieurs dièses échappés \\# dans le même titre', () => {
    const parsed = parseQuickTaskSyntax(
      'Comparer C\\# et F\\# #projets',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Comparer C# et F#');
    expect(parsed.categoryId).toBe('cat-projets');
  });

  it('14. supporte un dièse échappé \\# en tout début de saisie', () => {
    const parsed = parseQuickTaskSyntax(
      '\\#1 Ticket prioritaire #perso',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('#1 Ticket prioritaire');
    expect(parsed.categoryId).toBe('cat-perso');
  });

  it('15. n’interprète PAS le tiret " - " comme un jeton de catégorie (garde le titre intact)', () => {
    const p1 = parseQuickTaskSyntax(
      'Pré-rapport - Réunion',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    const p2 = parseQuickTaskSyntax(
      'Tâche - Sport',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(p1.title).toBe('Pré-rapport - Réunion');
    expect(p1.categoryId).toBeNull();
    expect(p2.title).toBe('Tâche - Sport');
    expect(p2.categoryId).toBeNull();
  });

  // --- 3. Mots-clés temporels relatifs et jours de la semaine ---
  it('16. résout @auj, @aujourdhui et @aujourd\'hui à la date de référence', () => {
    const p1 = parseQuickTaskSyntax('Tâche 1 @auj', MOCK_CATEGORIES, '2026-11-02');
    const p2 = parseQuickTaskSyntax(
      'Tâche 2 @aujourdhui',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    const p3 = parseQuickTaskSyntax(
      "Tâche 3 @aujourd'hui",
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(p1.dueDate).toBe('2026-11-02');
    expect(p2.dueDate).toBe('2026-11-02');
    expect(p3.dueDate).toBe('2026-11-02');
  });

  it('17. résout @demain au lendemain de la date de référence', () => {
    const parsed = parseQuickTaskSyntax(
      'Appeler la banque @demain',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.dueDate).toBe('2026-11-03');
  });

  it('18. résout les décalages relatifs @+3j et @+10', () => {
    const p1 = parseQuickTaskSyntax('Relance @+3j', MOCK_CATEGORIES, '2026-11-02');
    const p2 = parseQuickTaskSyntax('Bilan @+10', MOCK_CATEGORIES, '2026-11-02');
    expect(p1.dueDate).toBe('2026-11-05');
    expect(p2.dueDate).toBe('2026-11-12');
  });

  it('19. résout @lun / @lundi vers le prochain lundi strictement futur (+7 jours si on est lundi)', () => {
    const pShort = parseQuickTaskSyntax(
      'Réunion hebdo @lun',
      MOCK_CATEGORIES,
      '2026-11-02', // Lundi
    );
    const pFull = parseQuickTaskSyntax(
      'Réunion hebdo @lundi',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(pShort.dueDate).toBe('2026-11-09');
    expect(pFull.dueDate).toBe('2026-11-09');
  });

  it('20. résout @mar / @mardi et @mer / @mercredi vers la prochaine occurrence future', () => {
    const pMar = parseQuickTaskSyntax('Dentiste @mar', MOCK_CATEGORIES, '2026-11-02');
    const pMer = parseQuickTaskSyntax('Cinéma @mercredi', MOCK_CATEGORIES, '2026-11-02');
    expect(pMar.dueDate).toBe('2026-11-03');
    expect(pMer.dueDate).toBe('2026-11-04');
  });

  it('21. résout @jeu / @jeudi et @ven / @vendredi vers la prochaine occurrence future', () => {
    const pJeu = parseQuickTaskSyntax('Course @jeudi', MOCK_CATEGORIES, '2026-11-02');
    const pVen = parseQuickTaskSyntax('Livraison @ven', MOCK_CATEGORIES, '2026-11-02');
    expect(pJeu.dueDate).toBe('2026-11-05');
    expect(pVen.dueDate).toBe('2026-11-06');
  });

  it('22. résout @sam / @samedi et @dim / @dimanche vers la prochaine occurrence future', () => {
    const pSam = parseQuickTaskSyntax('Marché @sam', MOCK_CATEGORIES, '2026-11-02');
    const pDim = parseQuickTaskSyntax('Brunch @dimanche', MOCK_CATEGORIES, '2026-11-02');
    expect(pSam.dueDate).toBe('2026-11-07');
    expect(pDim.dueDate).toBe('2026-11-08');
  });

  it('23. gère correctement le changement de mois et d’année sur les dates relatives', () => {
    const endOfMonth = parseQuickTaskSyntax(
      'Clôture mensuelle @demain',
      MOCK_CATEGORIES,
      '2026-11-30',
    );
    const endOfYear = parseQuickTaskSyntax(
      'Vœux @+5j',
      MOCK_CATEGORIES,
      '2026-12-29',
    );
    expect(endOfMonth.dueDate).toBe('2026-12-01');
    expect(endOfYear.dueDate).toBe('2027-01-03');
  });

  it('24. gère correctement le 29 février sur une année bissextile (2028) vs non bissextile (2026)', () => {
    const leap = parseQuickTaskSyntax(
      'Anniversaire bissextile @demain',
      MOCK_CATEGORIES,
      '2028-02-28',
    );
    const nonLeap = parseQuickTaskSyntax(
      'Fin février @demain',
      MOCK_CATEGORIES,
      '2026-02-28',
    );
    expect(leap.dueDate).toBe('2028-02-29');
    expect(nonLeap.dueDate).toBe('2026-03-01');
  });

  // --- 4. Heures optionnelles sur les échéances ---
  it('25. extrait l’heure optionnelle au format 18h ou 14h30 (@demain 14h30)', () => {
    const parsed = parseQuickTaskSyntax(
      'Entretien visio @demain 14h30',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Entretien visio');
    expect(parsed.dueDate).toBe('2026-11-03');
    expect(parsed.hasDueTime).toBe(true);
    expect(parsed.dueTime).toBe('14:30');
  });

  it('26. extrait l’heure optionnelle sur une date courte (@15/11 09h) et au format deux-points (@auj 08:15)', () => {
    const p1 = parseQuickTaskSyntax(
      'Train départ @15/11 09h',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    const p2 = parseQuickTaskSyntax(
      'Standup @auj 08:15',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(p1.title).toBe('Train départ');
    expect(p1.dueDate).toBe('2026-11-15');
    expect(p1.hasDueTime).toBe(true);
    expect(p1.dueTime).toBe('09:00');
    expect(p2.dueDate).toBe('2026-11-02');
    expect(p2.hasDueTime).toBe(true);
    expect(p2.dueTime).toBe('08:15');
  });

  it('27. n’absorbe pas une heure invalide (ex: 25h) après une date', () => {
    const parsed = parseQuickTaskSyntax(
      'Test horaire @auj 25h',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.dueDate).toBe('2026-11-02');
    expect(parsed.hasDueTime).toBe(false);
    expect(parsed.dueTime).toBeNull();
    expect(parsed.title).toBe('Test horaire 25h');
  });

  // --- 5. Dates universelles avec '/' et '-' selon dateFormat ---
  it('28. supporte les dates courtes avec slash (@15/11) et tiret (@15-11) en DD-MM-YYYY', () => {
    const pSlash = parseQuickTaskSyntax(
      'Examen @15/11',
      MOCK_CATEGORIES,
      '2026-11-02',
      'DD-MM-YYYY',
    );
    const pDash = parseQuickTaskSyntax(
      'Examen @15-11',
      MOCK_CATEGORIES,
      '2026-11-02',
      'DD-MM-YYYY',
    );
    expect(pSlash.dueDate).toBe('2026-11-15');
    expect(pDash.dueDate).toBe('2026-11-15');
  });

  it('29. supporte les dates courtes en MM-DD-YYYY (@11/15 et @11-15)', () => {
    const pSlash = parseQuickTaskSyntax(
      'Deadline @11/15',
      MOCK_CATEGORIES,
      '2026-11-02',
      'MM-DD-YYYY',
    );
    const pDash = parseQuickTaskSyntax(
      'Deadline @11-15',
      MOCK_CATEGORIES,
      '2026-11-02',
      'MM-DD-YYYY',
    );
    expect(pSlash.dueDate).toBe('2026-11-15');
    expect(pDash.dueDate).toBe('2026-11-15');
  });

  it('30. applique le repli intelligent en MM-DD-YYYY si le premier nombre dépasse 12 (@15/11)', () => {
    const parsed = parseQuickTaskSyntax(
      'Rattrapage @15/11',
      MOCK_CATEGORIES,
      '2026-11-02',
      'MM-DD-YYYY',
    );
    expect(parsed.dueDate).toBe('2026-11-15');
  });

  it('31. supporte les dates complètes avec année en DD-MM-YYYY (@15/11/2026 et @15-11-2026)', () => {
    const pSlash = parseQuickTaskSyntax(
      'Soutenance @15/11/2026',
      MOCK_CATEGORIES,
      '2026-11-02',
      'DD-MM-YYYY',
    );
    const pDash = parseQuickTaskSyntax(
      'Soutenance @15-11-2026',
      MOCK_CATEGORIES,
      '2026-11-02',
      'DD-MM-YYYY',
    );
    expect(pSlash.dueDate).toBe('2026-11-15');
    expect(pDash.dueDate).toBe('2026-11-15');
  });

  it('32. supporte les dates complètes avec année en MM-DD-YYYY (@11/15/2026 et @11-15-2026)', () => {
    const pSlash = parseQuickTaskSyntax(
      'Release @11/15/2026',
      MOCK_CATEGORIES,
      '2026-11-02',
      'MM-DD-YYYY',
    );
    const pDash = parseQuickTaskSyntax(
      'Release @11-15-2026',
      MOCK_CATEGORIES,
      '2026-11-02',
      'MM-DD-YYYY',
    );
    expect(pSlash.dueDate).toBe('2026-11-15');
    expect(pDash.dueDate).toBe('2026-11-15');
  });

  it('33. supporte les dates ISO avec tiret (@2026-11-15) et slash (@2026/11/15) quel que soit dateFormat', () => {
    const p1 = parseQuickTaskSyntax(
      'Audit @2026-11-15',
      MOCK_CATEGORIES,
      '2026-11-02',
      'DD-MM-YYYY',
    );
    const p2 = parseQuickTaskSyntax(
      'Audit @2026/11/15',
      MOCK_CATEGORIES,
      '2026-11-02',
      'MM-DD-YYYY',
    );
    expect(p1.dueDate).toBe('2026-11-15');
    expect(p2.dueDate).toBe('2026-11-15');
  });

  it('34. accepte une instance Date JavaScript comme referenceToday dans parseQuickCapture', () => {
    const refDate = new Date('2026-11-02T09:00:00Z');
    const parsed = parseQuickCapture(
      'Bilan hebdo @demain',
      MOCK_CATEGORIES,
      refDate,
    );
    expect(parsed.dueDate).toBe('2026-11-03');
  });

  // --- 6. Priorités (!1 à !3) ---
  it('35. extrait les priorités !1 (basse), !2 (moyenne) et !3 (haute)', () => {
    expect(parseQuickTaskSyntax('T1 !1', MOCK_CATEGORIES).priority).toBe(1);
    expect(parseQuickTaskSyntax('T2 !2', MOCK_CATEGORIES).priority).toBe(2);
    expect(parseQuickTaskSyntax('T3 !3', MOCK_CATEGORIES).priority).toBe(3);
  });

  it('36. ignore les points d’exclamation hors plage (!0, !4, !) et les conserve dans le titre', () => {
    const p1 = parseQuickTaskSyntax('Attention ! Important', MOCK_CATEGORIES);
    const p2 = parseQuickTaskSyntax('Niveau !4 test', MOCK_CATEGORIES);
    expect(p1.priority).toBe(0);
    expect(p1.title).toBe('Attention ! Important');
    expect(p2.priority).toBe(0);
    expect(p2.title).toBe('Niveau !4 test');
  });

  // --- 7. Durées estimées (~durée) ---
  it('37. convertit les durées en minutes (~45m, ~30min, ~20)', () => {
    expect(parseQuickTaskSyntax('A ~45m', MOCK_CATEGORIES).estimatedMinutes).toBe(45);
    expect(parseQuickTaskSyntax('B ~30min', MOCK_CATEGORIES).estimatedMinutes).toBe(30);
    expect(parseQuickTaskSyntax('C ~20', MOCK_CATEGORIES).estimatedMinutes).toBe(20);
  });

  it('38. convertit les durées en heures (~2h, ~3H)', () => {
    expect(parseQuickTaskSyntax('A ~2h', MOCK_CATEGORIES).estimatedMinutes).toBe(120);
    expect(parseQuickTaskSyntax('B ~3H', MOCK_CATEGORIES).estimatedMinutes).toBe(180);
  });

  it('39. convertit les durées combinées heures et minutes (~1h30, ~2h15m)', () => {
    expect(
      parseQuickTaskSyntax('Réviser chapitre 4 @2026-11-15 ~1h30 !2', MOCK_CATEGORIES)
        .estimatedMinutes,
    ).toBe(90);
    expect(
      parseQuickTaskSyntax('Atelier ~2h15m', MOCK_CATEGORIES).estimatedMinutes,
    ).toBe(135);
  });

  // --- 8. Focus (*), ordres variés et jetons multiples ---
  it('40. extrait les jetons quel que soit leur ordre dans la chaîne', () => {
    const parsed = parseQuickTaskSyntax(
      '!2 ~1h15 @demain #sport Séance de natation *',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Séance de natation');
    expect(parsed.categoryId).toBe('cat-sport');
    expect(parsed.dueDate).toBe('2026-11-03');
    expect(parsed.priority).toBe(2);
    expect(parsed.estimatedMinutes).toBe(75);
    expect(parsed.addToFocus).toBe(true);
  });

  it('41. détecte l’étoile Focus * même si d’autres jetons la suivent en fin de saisie', () => {
    const parsed = parseQuickTaskSyntax(
      'Préparer sac de voyage * #perso !1',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Préparer sac de voyage');
    expect(parsed.categoryId).toBe('cat-perso');
    expect(parsed.priority).toBe(1);
    expect(parsed.addToFocus).toBe(true);
  });

  it('42. conserve le dernier jeton lorsque plusieurs jetons de même nature sont saisis', () => {
    const parsed = parseQuickTaskSyntax(
      'Tâche évolutive #ecole #sport !1 !3 ~30m ~1h @auj @demain',
      MOCK_CATEGORIES,
      '2026-11-02',
    );
    expect(parsed.title).toBe('Tâche évolutive');
    expect(parsed.categoryId).toBe('cat-sport');
    expect(parsed.priority).toBe(3);
    expect(parsed.estimatedMinutes).toBe(60);
    expect(parsed.dueDate).toBe('2026-11-03');
  });

  it('43. conserve le texte brut nettoyé si l’utilisateur ne saisit que des jetons sans titre', () => {
    const parsed = parseQuickTaskSyntax('#ecole !2', MOCK_CATEGORIES);
    expect(parsed.title).toBe('#ecole !2');
    expect(parsed.categoryId).toBe('cat-ecole');
    expect(parsed.priority).toBe(2);
  });

  // --- 9. Helpers formatDateByPreference, parseDateByPreference et getDateFormatPlaceholder ---
  it('44. formatDateByPreference formate une date ISO en DD-MM-YYYY par défaut', () => {
    expect(formatDateByPreference('2026-11-15')).toBe('15-11-2026');
    expect(formatDateByPreference('2026-11-15', 'DD-MM-YYYY')).toBe('15-11-2026');
  });

  it('45. formatDateByPreference formate une date ISO en MM-DD-YYYY', () => {
    expect(formatDateByPreference('2026-11-15', 'MM-DD-YYYY')).toBe('11-15-2026');
  });

  it('46. formatDateByPreference formate une date ISO en YYYY-MM-DD', () => {
    expect(formatDateByPreference('2026-11-15', 'YYYY-MM-DD')).toBe('2026-11-15');
  });

  it('47. formatDateByPreference retourne une chaîne vide pour null, undefined ou vide', () => {
    expect(formatDateByPreference(null)).toBe('');
    expect(formatDateByPreference(undefined)).toBe('');
    expect(formatDateByPreference('')).toBe('');
  });

  it('48. parseDateByPreference analyse les dates complètes en DD-MM-YYYY avec tiret ou slash', () => {
    expect(parseDateByPreference('15-11-2026', 'DD-MM-YYYY')).toBe('2026-11-15');
    expect(parseDateByPreference('05/03/2026', 'DD-MM-YYYY')).toBe('2026-03-05');
  });

  it('49. parseDateByPreference analyse les dates complètes en MM-DD-YYYY avec tiret ou slash', () => {
    expect(parseDateByPreference('11-15-2026', 'MM-DD-YYYY')).toBe('2026-11-15');
    expect(parseDateByPreference('03/05/2026', 'MM-DD-YYYY')).toBe('2026-03-05');
  });

  it('50. parseDateByPreference analyse les dates YYYY-MM-DD et YYYY/MM/DD', () => {
    expect(parseDateByPreference('2026-11-15', 'YYYY-MM-DD')).toBe('2026-11-15');
    expect(parseDateByPreference('2026/03/05', 'DD-MM-YYYY')).toBe('2026-03-05');
  });

  it('51. parseDateByPreference analyse les dates courtes sans année selon referenceYear', () => {
    expect(parseDateByPreference('15/11', 'DD-MM-YYYY', 2026)).toBe('2026-11-15');
    expect(parseDateByPreference('11-15', 'MM-DD-YYYY', 2027)).toBe('2027-11-15');
  });

  it('52. parseDateByPreference rejette les mois invalides (< 1 ou > 12)', () => {
    expect(parseDateByPreference('15-13-2026', 'DD-MM-YYYY')).toBeNull();
    expect(parseDateByPreference('15-00-2026', 'DD-MM-YYYY')).toBeNull();
    expect(parseDateByPreference('2026-13-01', 'YYYY-MM-DD')).toBeNull();
  });

  it('53. parseDateByPreference rejette les jours calendaires inexistants (31 avril, 30 février, 32 janvier)', () => {
    expect(parseDateByPreference('31-04-2026', 'DD-MM-YYYY')).toBeNull();
    expect(parseDateByPreference('30-02-2026', 'DD-MM-YYYY')).toBeNull();
    expect(parseDateByPreference('32-01-2026', 'DD-MM-YYYY')).toBeNull();
  });

  it('54. parseDateByPreference valide le 29 février uniquement sur les années bissextiles', () => {
    expect(parseDateByPreference('29-02-2026', 'DD-MM-YYYY')).toBeNull();
    expect(parseDateByPreference('29-02-2028', 'DD-MM-YYYY')).toBe('2028-02-29');
  });

  it('55. parseDateByPreference retourne null sur une entrée vide ou malformée', () => {
    expect(parseDateByPreference('')).toBeNull();
    expect(parseDateByPreference('   ')).toBeNull();
    expect(parseDateByPreference('pas-une-date')).toBeNull();
  });

  it('56. getDateFormatPlaceholder retourne le placeholder localisé correspondant au format', () => {
    expect(getDateFormatPlaceholder('DD-MM-YYYY')).toBe('JJ-MM-AAAA');
    expect(getDateFormatPlaceholder('MM-DD-YYYY')).toBe('MM-JJ-AAAA');
    expect(getDateFormatPlaceholder('YYYY-MM-DD')).toBe('AAAA-MM-JJ');
  });

  // --- 10. Helpers d'affichage existants (rétrocompatibilité) ---
  it('57. formatDurationShort formate correctement les durées en français', () => {
    expect(formatDurationShort(null)).toBeNull();
    expect(formatDurationShort(0)).toBeNull();
    expect(formatDurationShort(45)).toBe('45 min');
    expect(formatDurationShort(60)).toBe('1 h');
    expect(formatDurationShort(90)).toBe('1 h 30');
  });

  it('58. formatShortDueDateFr formate Aujourd’hui, À planifier et les autres dates', () => {
    const labels = { today: "Aujourd'hui", toPlan: 'À planifier' };
    expect(formatShortDueDateFr('2026-11-02', '2026-11-02', labels)).toBe(
      "Aujourd'hui",
    );
    expect(formatShortDueDateFr(null, '2026-11-02', labels)).toBe('À planifier');
    expect(formatShortDueDateFr('2026-11-15', '2026-11-02', labels)).toContain(
      '15',
    );
  });

  it('59. formatEditorialDateFr retourne une date longue capitalisée en français', () => {
    const formatted = formatEditorialDateFr('2026-11-02');
    expect(formatted).toMatch(/^[A-ZÀ-Ÿ]/);
    expect(formatted.toLowerCase()).toContain('2026');
  });

  it('60. résout une catégorie par préfixe unique du nom lorsque l’alias diffère du nom', () => {
    const customCategories: CategoryRecord[] = [
      ...MOCK_CATEGORIES,
      {
        id: 'cat-recherche',
        name: 'Mémoire Universitaire',
        alias: 'thd',
        color: '--cat-3',
        position: 8,
        is_system: false,
        created_at: '2026-11-02T00:00:00Z',
        updated_at: '2026-11-02T00:00:00Z',
        deleted_at: null,
        device_id: 'dev-1',
      },
    ];
    const byAlias = parseQuickTaskSyntax('Bibliographie #thd', customCategories);
    const byNamePrefix = parseQuickTaskSyntax(
      'Plan détaillé #memoire',
      customCategories,
    );
    expect(byAlias.categoryId).toBe('cat-recherche');
    expect(byNamePrefix.categoryId).toBe('cat-recherche');
    expect(byNamePrefix.categoryName).toBe('Mémoire Universitaire');
  });

  it('61. accepte QuickParseOptions { now, dateFormat } dans parseQuickCapture(rawInput, categories, options) et parseQuickCapture(rawInput, options)', () => {
    const withCatsAndOptions = parseQuickCapture(
      'Rapport financier #ecole @11-15-2026 !3 ~45m *',
      MOCK_CATEGORIES,
      {
        now: '2026-11-02',
        dateFormat: 'MM-DD-YYYY',
      },
    );
    expect(withCatsAndOptions.title).toBe('Rapport financier');
    expect(withCatsAndOptions.categoryId).toBe('cat-ecole');
    expect(withCatsAndOptions.dueDate).toBe('2026-11-15');
    expect(withCatsAndOptions.priority).toBe(3);
    expect(withCatsAndOptions.estimatedMinutes).toBe(45);
    expect(withCatsAndOptions.addToFocus).toBe(true);

    const directOptions = parseQuickCapture('Bilan @15-11-2026 !2', {
      now: '2026-11-02',
      dateFormat: 'DD-MM-YYYY',
    });
    expect(directOptions.title).toBe('Bilan');
    expect(directOptions.dueDate).toBe('2026-11-15');
    expect(directOptions.priority).toBe(2);
  });
});
