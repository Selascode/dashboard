import ICAL from 'ical.js';
import {
  CalendarEventInput,
  CalendarEventRecord,
  CalendarSourceRecord,
  TaskRecord,
  TaskStatus,
  fetchCalendarSourceIcs,
  listCalendarEvents,
  listCalendarSources,
  recordCalendarSourceError,
  saveCalendarEventsForSource,
} from './db';

/**
 * Occurrence dépliée d'un événement d'agenda (simple ou récurrent) sur une fenêtre temporelle [AGD-4].
 * Toujours en lecture seule (`readonly: true`) dans le MVP [AGD-2, AGD-3].
 */
export interface ExpandedCalendarEvent {
  occurrence_id: string;
  event_id: string;
  source_id: string;
  ics_uid: string;
  title: string;
  start_at: string;
  end_at: string;
  day_key: string;
  start_time_label: string | null;
  end_time_label: string | null;
  is_all_day: boolean;
  location: string;
  notes: string;
  is_recurring: boolean;
  readonly: true;
}

/**
 * Élément d'agenda provenant d'une source ICS (`kind: 'ics_event'`) [AGD-4, AGD-6].
 */
export interface AgendaIcsEventItem extends ExpandedCalendarEvent {
  kind: 'ics_event';
  readonly: true;
  time_label: string | null;
}

/**
 * Élément d'agenda provenant de l'échéance d'une tâche (`kind: 'task_deadline'`) [AGD-6].
 */
export interface AgendaTaskDeadlineItem {
  kind: 'task_deadline';
  id: string;
  occurrence_id: string;
  task_id: string;
  title: string;
  notes: string;
  day_key: string;
  due_date: string;
  has_due_time: boolean;
  time_label: string | null;
  start_time_label: string | null;
  end_time_label: null;
  is_all_day: boolean;
  priority: number;
  status: TaskStatus;
  category_id: string;
  estimated_minutes: number | null;
  readonly: false;
}

/**
 * Union discriminée pour la superposition des événements ICS et des échéances de tâches [AGD-6].
 */
export type AgendaTimelineItem = AgendaIcsEventItem | AgendaTaskDeadlineItem;

export interface AgendaDaySummary {
  dayKey: string;
  eventCount: number;
  deadlineCount: number;
  totalCount: number;
  events: AgendaIcsEventItem[];
  deadlines: AgendaTaskDeadlineItem[];
  items: AgendaTimelineItem[];
}

export interface CalendarSourceSyncResult {
  sourceId: string;
  success: boolean;
  events: CalendarEventRecord[];
  syncedCount: number;
  preservedOfflineCache: boolean;
  error: string | null;
}

export interface SyncAllCalendarSourcesOptions {
  onlyDue?: boolean;
  now?: Date;
}

export interface SyncAllCalendarSourcesSummary {
  results: CalendarSourceSyncResult[];
  syncedSourcesCount: number;
  failedSourcesCount: number;
  skippedSourcesCount: number;
}

const MAX_RECUR_ITERATIONS = 5000;
const DEFAULT_TIMED_DURATION_MS = 60 * 60 * 1000; // 1 heure par défaut si DTEND et DURATION sont absents

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

function parseYmdParts(ymd: string): { year: number; month: number; day: number } | null {
  const match = ymd.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    return null;
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const parts = parseYmdParts(ymd);
  if (!parts) {
    return ymd;
  }
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, 12, 0, 0));
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Calcule le décalage en millisecondes d'un fuseau IANA (ex. 'Europe/Paris') par rapport à UTC
 * à un instant donné `utcGuessMs` en utilisant `Intl.DateTimeFormat`.
 */
function getIanaTimezoneOffsetMs(tzid: string, utcGuessMs: number): number | null {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tzid,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const parts = formatter.formatToParts(new Date(utcGuessMs));
    let year = 0;
    let month = 0;
    let day = 0;
    let hour = 0;
    let minute = 0;
    let second = 0;

    for (const part of parts) {
      switch (part.type) {
        case 'year':
          year = Number(part.value);
          break;
        case 'month':
          month = Number(part.value);
          break;
        case 'day':
          day = Number(part.value);
          break;
        case 'hour':
          hour = Number(part.value);
          if (hour === 24) hour = 0;
          break;
        case 'minute':
          minute = Number(part.value);
          break;
        case 'second':
          second = Number(part.value);
          break;
      }
    }
    if (!year || !month || !day) {
      return null;
    }
    const wallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    const roundedGuess = Math.floor(utcGuessMs / 1000) * 1000;
    return wallTimeAsUtc - roundedGuess;
  } catch {
    return null;
  }
}

/**
 * Convertit une date/heure locale exprimée dans un fuseau IANA (`tzid`) vers un objet `Date` UTC exact.
 */
function wallClockInTimezoneToUtcDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  tzid: string,
): Date | null {
  const cleanTz = tzid.trim();
  if (!cleanTz) {
    return null;
  }
  if (/^(utc|gmt|z|etc\/utc|etc\/gmt)$/i.test(cleanTz)) {
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  }

  const wallAsUtcMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const firstOffset = getIanaTimezoneOffsetMs(cleanTz, wallAsUtcMs);
  if (firstOffset === null) {
    return null;
  }
  const firstCandidateMs = wallAsUtcMs - firstOffset;
  const secondOffset = getIanaTimezoneOffsetMs(cleanTz, firstCandidateMs);
  const finalMs =
    secondOffset !== null ? wallAsUtcMs - secondOffset : firstCandidateMs;
  return new Date(finalMs);
}

/**
 * Résout le `TZID` attaché à une propriété `ICAL.Property` ou à une instance `ICAL.Time`.
 */
function extractTzid(time: ICAL.Time, prop?: ICAL.Property | null): string | null {
  if (prop) {
    const paramTz = prop.getFirstParameter('tzid');
    if (typeof paramTz === 'string' && paramTz.trim()) {
      return paramTz.trim();
    }
  }
  const zoneTzid = time.zone?.tzid;
  if (typeof zoneTzid === 'string' && zoneTzid.trim()) {
    return zoneTzid.trim();
  }
  return null;
}

/**
 * Convertit un `ICAL.Time` en chaîne normalisée :
 * - `YYYY-MM-DD` si `time.isDate === true` (événement journée entière, sans fuseau)
 * - `YYYY-MM-DDTHH:mm:ss.sssZ` (ISO 8601 UTC) pour un événement horodaté
 */
function normalizeIcalTimeToStorageString(
  time: ICAL.Time,
  prop?: ICAL.Property | null,
  vcalendarComp?: ICAL.Component | null,
): string {
  if (time.isDate) {
    return formatYmd(time.year, time.month, time.day);
  }

  const tzid = extractTzid(time, prop);

  // 1. Si c'est explicitement UTC (ex. suffixe Z)
  if (
    time.zone === ICAL.Timezone.utcTimezone ||
    (tzid && /^(utc|gmt|z|etc\/utc|etc\/gmt)$/i.test(tzid))
  ) {
    return new Date(
      Date.UTC(
        time.year,
        time.month - 1,
        time.day,
        time.hour,
        time.minute,
        time.second,
      ),
    ).toISOString();
  }

  // 2. Si un TZID est fourni (ex. Europe/Paris, America/New_York)
  if (tzid && tzid.toLowerCase() !== 'floating') {
    const ianaDate = wallClockInTimezoneToUtcDate(
      time.year,
      time.month,
      time.day,
      time.hour,
      time.minute,
      time.second,
      tzid,
    );
    if (ianaDate && !Number.isNaN(ianaDate.getTime())) {
      return ianaDate.toISOString();
    }

    // Repli sur une éventuelle définition VTIMEZONE embarquée dans le composant VCALENDAR
    if (vcalendarComp) {
      const vtz = vcalendarComp.getTimeZoneByID(tzid);
      if (vtz) {
        const cloned = time.clone();
        cloned.zone = vtz;
        const jsDate = cloned.toJSDate();
        if (!Number.isNaN(jsDate.getTime())) {
          return jsDate.toISOString();
        }
      }
    }
  }

  // 3. Heure flottante (floating) : interprétée dans le fuseau local de l'appareil
  const localDate = new Date(
    time.year,
    time.month - 1,
    time.day,
    time.hour,
    time.minute,
    time.second,
  );
  return localDate.toISOString();
}

/**
 * Nettoie une chaîne texte issue d'une propriété ICS (`SUMMARY`, `LOCATION`, `DESCRIPTION`).
 */
function cleanIcsText(value: unknown, fallback = ''): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value
    .replace(/\r\n/g, '\n')
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
  return normalized || fallback;
}

/**
 * Extrait la chaîne brute `RRULE` d'un composant `VEVENT` si elle est présente.
 */
function extractRawRruleString(veventComp: ICAL.Component): string | null {
  const rruleProp = veventComp.getFirstProperty('rrule');
  if (!rruleProp) {
    return null;
  }
  const val = rruleProp.getFirstValue();
  if (!val) {
    return null;
  }
  const raw = typeof val === 'string' ? val : val.toString();
  const cleaned = raw.replace(/^RRULE:/i, '').trim();
  return cleaned || null;
}

/**
 * Extrait toutes les dates d'exclusion `EXDATE` d'un composant `VEVENT`
 * sous forme de chaînes normalisées (`YYYY-MM-DD` ou ISO 8601 UTC).
 */
function extractExdatesFromVevent(
  veventComp: ICAL.Component,
  vcalendarComp: ICAL.Component,
): string[] {
  const exdateProps = veventComp.getAllProperties('exdate');
  const results: string[] = [];

  for (const prop of exdateProps) {
    const values = prop.getValues();
    for (const val of values) {
      if (val && typeof val === 'object' && 'year' in val && 'month' in val && 'day' in val) {
        const icalTime = val as ICAL.Time;
        results.push(
          normalizeIcalTimeToStorageString(icalTime, prop, vcalendarComp),
        );
      } else if (typeof val === 'string' && val.trim()) {
        try {
          const parsedTime = ICAL.Time.fromString(val.trim(), prop);
          results.push(
            normalizeIcalTimeToStorageString(parsedTime, prop, vcalendarComp),
          );
        } catch {
          results.push(val.trim());
        }
      }
    }
  }

  return Array.from(new Set(results));
}

/**
 * Enregistre les composants `VTIMEZONE` présents dans le flux au sein de `ICAL.TimezoneService`.
 */
function registerVtimezones(vcalendarComp: ICAL.Component): void {
  const vtimezones = vcalendarComp.getAllSubcomponents('vtimezone');
  for (const vtzComp of vtimezones) {
    try {
      const tzid = vtzComp.getFirstPropertyValue('tzid');
      if (typeof tzid === 'string' && tzid.trim()) {
        const timezone = new ICAL.Timezone({
          component: vtzComp,
          tzid: tzid.trim(),
        });
        ICAL.TimezoneService.register(timezone);
      }
    } catch {
      // Ignorer un VTIMEZONE malformé sans bloquer le parsing
    }
  }
}

/**
 * Construit un `CalendarEventInput` à partir d'un composant `VEVENT` et d'éventuelles `EXDATE` additionnelles.
 */
function buildCalendarEventInputFromVevent(
  veventComp: ICAL.Component,
  vcalendarComp: ICAL.Component,
  extraExdates: string[] = [],
  uidSuffix = '',
): CalendarEventInput | null {
  const event = new ICAL.Event(veventComp);
  const dtstartProp = veventComp.getFirstProperty('dtstart');
  const startDate = event.startDate;
  if (!startDate || !dtstartProp) {
    return null;
  }

  const rawUid = cleanIcsText(event.uid, '');
  const baseUid = rawUid || `generated-uid-${ startDate.toICALString() }`;
  const ics_uid = uidSuffix ? `${baseUid}::${uidSuffix}` : baseUid;

  const title = cleanIcsText(event.summary, 'Sans titre');
  const location = cleanIcsText(event.location, '');
  const notes = cleanIcsText(event.description, '');
  const is_all_day = Boolean(startDate.isDate);

  const start_at = normalizeIcalTimeToStorageString(
    startDate,
    dtstartProp,
    vcalendarComp,
  );

  const dtendProp = veventComp.getFirstProperty('dtend');
  const durationProp = veventComp.getFirstProperty('duration');
  const hasExplicitEndOrDuration = Boolean(dtendProp || durationProp);
  const endDate = event.endDate;
  let end_at: string;

  if (is_all_day) {
    if (hasExplicitEndOrDuration && endDate && endDate.isDate) {
      const endYmd = formatYmd(endDate.year, endDate.month, endDate.day);
      end_at = endYmd <= start_at ? addDaysToYmd(start_at, 1) : endYmd;
    } else {
      end_at = addDaysToYmd(start_at, 1);
    }
  } else {
    if (hasExplicitEndOrDuration && endDate) {
      const normalizedEnd = normalizeIcalTimeToStorageString(
        endDate,
        dtendProp ?? dtstartProp,
        vcalendarComp,
      );
      const startMs = Date.parse(start_at);
      const endMs = Date.parse(normalizedEnd);
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
        end_at = normalizedEnd;
      } else if (!Number.isNaN(startMs)) {
        end_at = new Date(startMs + DEFAULT_TIMED_DURATION_MS).toISOString();
      } else {
        end_at = normalizedEnd;
      }
    } else {
      const startMs = Date.parse(start_at);
      end_at = Number.isNaN(startMs)
        ? start_at
        : new Date(startMs + DEFAULT_TIMED_DURATION_MS).toISOString();
    }
  }

  const isRecurrenceOverride = veventComp.hasProperty('recurrence-id');
  const rrule = isRecurrenceOverride ? null : extractRawRruleString(veventComp);

  const ownExdates = isRecurrenceOverride
    ? []
    : extractExdatesFromVevent(veventComp, vcalendarComp);
  const mergedExdates = Array.from(new Set([...ownExdates, ...extraExdates]));

  return {
    ics_uid,
    title,
    start_at,
    end_at,
    is_all_day,
    location,
    notes,
    rrule,
    exdates_json: JSON.stringify(mergedExdates),
    exdates: mergedExdates,
  };
}

/**
 * AGD-4 : Analyse un flux ICS brut (`VCALENDAR` / `VEVENT`) via `ical.js` et retourne
 * la liste normalisée des `CalendarEventInput` prêts à être persistés dans le cache local.
 * - Gère les fuseaux horaires (`TZID` ex. `Europe/Paris`, `UTC`, heure flottante).
 * - Gère les événements journée entière (`VALUE=DATE`).
 * - Extrait `RRULE`, `EXDATE` et prend en compte les exceptions `RECURRENCE-ID` (en ajoutant
 *   la date remplacée aux `EXDATE` de l'événement maître et en conservant l'événement modifié).
 */
export function parseIcsFeed(rawIcs: string): CalendarEventInput[] {
  const trimmed = (rawIcs ?? '').trim();
  if (!trimmed) {
    throw new Error('Le flux ICS est vide [AGD-4].');
  }

  let jcalData: unknown;
  try {
    jcalData = ICAL.parse(trimmed);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`Flux ICS invalide : ${detail} [AGD-4].`);
  }

  if (!Array.isArray(jcalData)) {
    throw new Error(
      'Flux ICS invalide : structure jCal non reconnue [AGD-4].',
    );
  }

  const rootComp = new ICAL.Component(jcalData);
  const vcalendars =
    rootComp.name === 'vcalendar'
      ? [rootComp]
      : rootComp.getAllSubcomponents('vcalendar');

  if (vcalendars.length === 0) {
    throw new Error(
      'Flux ICS invalide : aucun composant VCALENDAR trouvé [AGD-4].',
    );
  }

  const parsedEvents: CalendarEventInput[] = [];

  for (const vcal of vcalendars) {
    registerVtimezones(vcal);
    const vevents = vcal.getAllSubcomponents('vevent');

    // Regrouper les exceptions RECURRENCE-ID par UID pour exclure leur date de l'événement maître
    const overrideDatesByUid = new Map<string, string[]>();
    const masterVevents: ICAL.Component[] = [];
    const overrideVevents: Array<{
      comp: ICAL.Component;
      recurrenceNorm: string;
    }> = [];

    for (const vevent of vevents) {
      const statusVal = cleanIcsText(
        vevent.getFirstPropertyValue('status'),
        '',
      ).toUpperCase();
      const recIdProp = vevent.getFirstProperty('recurrence-id');

      if (recIdProp) {
        const uid = cleanIcsText(vevent.getFirstPropertyValue('uid'), '');
        const recVal = recIdProp.getFirstValue();
        let recNorm = '';
        if (
          recVal &&
          typeof recVal === 'object' &&
          'year' in recVal &&
          'month' in recVal &&
          'day' in recVal
        ) {
          recNorm = normalizeIcalTimeToStorageString(
            recVal as ICAL.Time,
            recIdProp,
            vcal,
          );
        }
        if (uid && recNorm) {
          const list = overrideDatesByUid.get(uid) ?? [];
          list.push(recNorm);
          overrideDatesByUid.set(uid, list);
        }
        // Si l'exception n'est pas annulée (STATUS:CANCELLED), on l'ajoute comme événement distinct
        if (statusVal !== 'CANCELLED') {
          overrideVevents.push({
            comp: vevent,
            recurrenceNorm: recNorm || String(overrideVevents.length + 1),
          });
        }
      } else {
        if (statusVal !== 'CANCELLED') {
          masterVevents.push(vevent);
        }
      }
    }

    for (const masterComp of masterVevents) {
      const uid = cleanIcsText(masterComp.getFirstPropertyValue('uid'), '');
      const extraExdates = uid ? (overrideDatesByUid.get(uid) ?? []) : [];
      const built = buildCalendarEventInputFromVevent(
        masterComp,
        vcal,
        extraExdates,
      );
      if (built) {
        parsedEvents.push(built);
      }
    }

    for (const { comp, recurrenceNorm } of overrideVevents) {
      const built = buildCalendarEventInputFromVevent(
        comp,
        vcal,
        [],
        `override-${recurrenceNorm}`,
      );
      if (built) {
        parsedEvents.push(built);
      }
    }
  }

  return parsedEvents;
}

/**
 * Formate une Date JavaScript en clé de jour locale `YYYY-MM-DD`.
 */
export function toLocalDayKey(date: Date): string {
  return formatYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Formate une Date JavaScript en étiquette d'heure locale `HH:mm`.
 */
export function toLocalTimeLabel(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Parse en toute sécurité `exdates_json` en ensembles de clés pour filtrage rapide :
 * - `exactTimestampsMs`: timestamps UTC en secondes/ms pour correspondance exacte d'instant
 * - `dayKeys`: dates `YYYY-MM-DD` (UTC et locales) pour exclure une journée d'occurrence
 */
function parseExdatesLookup(exdatesJson: string): {
  exactSeconds: Set<number>;
  dayKeys: Set<string>;
} {
  const exactSeconds = new Set<number>();
  const dayKeys = new Set<string>();

  if (!exdatesJson || !exdatesJson.trim()) {
    return { exactSeconds, dayKeys };
  }

  let rawList: unknown;
  try {
    rawList = JSON.parse(exdatesJson);
  } catch {
    return { exactSeconds, dayKeys };
  }

  if (!Array.isArray(rawList)) {
    return { exactSeconds, dayKeys };
  }

  for (const item of rawList) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      dayKeys.add(trimmed);
      continue;
    }

    const ymdPrefix = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymdPrefix)) {
      dayKeys.add(ymdPrefix);
    }

    const ms = Date.parse(trimmed);
    if (!Number.isNaN(ms)) {
      exactSeconds.add(Math.floor(ms / 1000));
      const d = new Date(ms);
      dayKeys.add(toLocalDayKey(d));
      dayKeys.add(
        formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()),
      );
    }
  }

  return { exactSeconds, dayKeys };
}

/**
 * Crée un `ICAL.Time` à partir d'une chaîne stockée (`YYYY-MM-DD` ou ISO UTC).
 */
function storageStringToIcalTime(value: string, isAllDay: boolean): ICAL.Time | null {
  const trimmed = value.trim();
  if (isAllDay || /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parts = parseYmdParts(trimmed);
    if (!parts) return null;
    return ICAL.Time.fromData({
      year: parts.year,
      month: parts.month,
      day: parts.day,
      isDate: true,
    });
  }

  const ms = Date.parse(trimmed);
  if (Number.isNaN(ms)) {
    return null;
  }
  const d = new Date(ms);
  return ICAL.Time.fromData(
    {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds(),
      isDate: false,
    },
    ICAL.Timezone.utcTimezone,
  );
}

/**
 * Calcule le nombre de jours couverts par un événement journée entière (`>= 1`).
 */
function computeAllDaySpanDays(startYmd: string, endYmd: string): number {
  const s = parseYmdParts(startYmd);
  const e = parseYmdParts(endYmd);
  if (!s || !e) return 1;
  const startUtc = Date.UTC(s.year, s.month - 1, s.day);
  const endUtc = Date.UTC(e.year, e.month - 1, e.day);
  const diffDays = Math.round((endUtc - startUtc) / 86400000);
  return Math.max(1, diffDays);
}

/**
 * Génère les entrées `ExpandedCalendarEvent` d'une occurrence journée entière
 * sur chacun des jours de `[rangeStartDate, rangeEndDate]` qu'elle couvre.
 */
function expandAllDayOccurrenceIntoRange(
  event: CalendarEventRecord,
  occurrenceStartYmd: string,
  spanDays: number,
  isRecurring: boolean,
  rangeStartDate: string,
  rangeEndDate: string,
): ExpandedCalendarEvent[] {
  const occurrenceEndYmd = addDaysToYmd(occurrenceStartYmd, spanDays);
  const results: ExpandedCalendarEvent[] = [];

  for (let offset = 0; offset < spanDays; offset += 1) {
    const dayKey = addDaysToYmd(occurrenceStartYmd, offset);
    if (dayKey < rangeStartDate || dayKey > rangeEndDate) {
      continue;
    }
    const suffix = spanDays > 1 ? `${occurrenceStartYmd}@${dayKey}` : dayKey;
    results.push({
      occurrence_id: `${event.id}:${suffix}`,
      event_id: event.id,
      source_id: event.source_id,
      ics_uid: event.ics_uid,
      title: event.title || 'Sans titre',
      start_at: occurrenceStartYmd,
      end_at: occurrenceEndYmd,
      day_key: dayKey,
      start_time_label: null,
      end_time_label: null,
      is_all_day: true,
      location: event.location ?? '',
      notes: event.notes ?? '',
      is_recurring: isRecurring,
      readonly: true,
    });
  }

  return results;
}

/**
 * Crée une entrée `ExpandedCalendarEvent` pour une occurrence horodatée si elle tombe
 * dans la fenêtre locale `[rangeStartDate, rangeEndDate]`.
 */
function buildTimedOccurrenceInRange(
  event: CalendarEventRecord,
  occStartMs: number,
  durationMs: number,
  isRecurring: boolean,
  rangeStartDate: string,
  rangeEndDate: string,
): ExpandedCalendarEvent | null {
  const occEndMs = occStartMs + Math.max(0, durationMs);
  const startDate = new Date(occStartMs);
  const endDate = new Date(occEndMs);

  const startDayKey = toLocalDayKey(startDate);
  const endDayKey = toLocalDayKey(endDate);

  if (endDayKey < rangeStartDate || startDayKey > rangeEndDate) {
    return null;
  }

  const dayKey =
    startDayKey < rangeStartDate ? rangeStartDate : startDayKey;
  const startIso = startDate.toISOString();
  const endIso = endDate.toISOString();

  return {
    occurrence_id: `${event.id}:${startIso}`,
    event_id: event.id,
    source_id: event.source_id,
    ics_uid: event.ics_uid,
    title: event.title || 'Sans titre',
    start_at: startIso,
    end_at: endIso,
    day_key: dayKey,
    start_time_label: toLocalTimeLabel(startDate),
    end_time_label: toLocalTimeLabel(endDate),
    is_all_day: false,
    location: event.location ?? '',
    notes: event.notes ?? '',
    is_recurring: isRecurring,
    readonly: true,
  };
}

/**
 * AGD-4 : Déplie les événements d'agenda (simples et récurrents `RRULE`) sur la fenêtre
 * de dates locales `[rangeStartDate, rangeEndDate]` (`YYYY-MM-DD`).
 * - Exclut strictement les occurrences présentes dans `exdates_json` (`EXDATE`).
 * - Respecte `FREQ`, `INTERVAL`, `BYDAY`, `BYMONTHDAY`, `COUNT`, `UNTIL`.
 * - Conserve la durée initiale de l'événement sur chaque occurrence.
 */
export function expandCalendarEventsForRange(
  events: readonly CalendarEventRecord[],
  rangeStartDate: string,
  rangeEndDate: string,
): ExpandedCalendarEvent[] {
  const startBound = rangeStartDate.trim().slice(0, 10);
  const endBound = rangeEndDate.trim().slice(0, 10);
  if (!startBound || !endBound || startBound > endBound) {
    return [];
  }

  const endParts = parseYmdParts(endBound);
  const rangeEndLimitMs = endParts
    ? new Date(
        endParts.year,
        endParts.month - 1,
        endParts.day,
        23,
        59,
        59,
        999,
      ).getTime()
    : Number.MAX_SAFE_INTEGER;

  const expanded: ExpandedCalendarEvent[] = [];

  for (const event of events) {
    const rruleStr = event.rrule?.trim() || null;
    const isAllDay = Boolean(event.is_all_day);

    if (!rruleStr) {
      // Événement non récurrent
      if (isAllDay) {
        const startYmd = event.start_at.trim().slice(0, 10);
        const endYmd = event.end_at.trim().slice(0, 10);
        const spanDays = computeAllDaySpanDays(startYmd, endYmd);
        expanded.push(
          ...expandAllDayOccurrenceIntoRange(
            event,
            startYmd,
            spanDays,
            false,
            startBound,
            endBound,
          ),
        );
      } else {
        const startMs = Date.parse(event.start_at);
        if (Number.isNaN(startMs)) continue;
        const endMs = Date.parse(event.end_at);
        const durationMs =
          !Number.isNaN(endMs) && endMs >= startMs
            ? endMs - startMs
            : DEFAULT_TIMED_DURATION_MS;
        const occ = buildTimedOccurrenceInRange(
          event,
          startMs,
          durationMs,
          false,
          startBound,
          endBound,
        );
        if (occ) {
          expanded.push(occ);
        }
      }
      continue;
    }

    // Événement récurrent (RRULE)
    const dtstart = storageStringToIcalTime(event.start_at, isAllDay);
    if (!dtstart) {
      continue;
    }

    let recur: ICAL.Recur;
    try {
      const normalizedRrule = rruleStr.replace(/^RRULE:/i, '').trim();
      recur = ICAL.Recur.fromString(normalizedRrule);
    } catch {
      continue;
    }

    const { exactSeconds, dayKeys: excludedDayKeys } = parseExdatesLookup(
      event.exdates_json,
    );

    const spanDays = isAllDay
      ? computeAllDaySpanDays(
          event.start_at.trim().slice(0, 10),
          event.end_at.trim().slice(0, 10),
        )
      : 1;

    const baseStartMs = isAllDay ? 0 : Date.parse(event.start_at);
    const baseEndMs = isAllDay ? 0 : Date.parse(event.end_at);
    const durationMs =
      !isAllDay && !Number.isNaN(baseStartMs) && !Number.isNaN(baseEndMs) && baseEndMs >= baseStartMs
        ? baseEndMs - baseStartMs
        : DEFAULT_TIMED_DURATION_MS;

    const iterator = recur.iterator(dtstart);
    let iterations = 0;

    while (iterations < MAX_RECUR_ITERATIONS) {
      iterations += 1;
      const nextTime = iterator.next();
      if (!nextTime) {
        break;
      }

      if (isAllDay) {
        const occYmd = formatYmd(nextTime.year, nextTime.month, nextTime.day);
        if (occYmd > endBound) {
          break;
        }
        if (excludedDayKeys.has(occYmd)) {
          continue;
        }
        expanded.push(
          ...expandAllDayOccurrenceIntoRange(
            event,
            occYmd,
            spanDays,
            true,
            startBound,
            endBound,
          ),
        );
      } else {
        const occMs = Date.UTC(
          nextTime.year,
          nextTime.month - 1,
          nextTime.day,
          nextTime.hour,
          nextTime.minute,
          nextTime.second,
        );
        if (occMs > rangeEndLimitMs) {
          break;
        }
        const occSec = Math.floor(occMs / 1000);
        const occDate = new Date(occMs);
        const localDay = toLocalDayKey(occDate);
        const utcDay = formatYmd(
          occDate.getUTCFullYear(),
          occDate.getUTCMonth() + 1,
          occDate.getUTCDate(),
        );

        if (
          exactSeconds.has(occSec) ||
          excludedDayKeys.has(localDay) ||
          excludedDayKeys.has(utcDay)
        ) {
          continue;
        }

        const occ = buildTimedOccurrenceInRange(
          event,
          occMs,
          durationMs,
          true,
          startBound,
          endBound,
        );
        if (occ) {
          expanded.push(occ);
        }
      }
    }
  }

  return expanded.sort(compareExpandedEvents);
}

function compareExpandedEvents(
  a: ExpandedCalendarEvent,
  b: ExpandedCalendarEvent,
): number {
  if (a.day_key !== b.day_key) {
    return a.day_key.localeCompare(b.day_key);
  }
  if (a.is_all_day !== b.is_all_day) {
    return a.is_all_day ? -1 : 1;
  }
  const timeA = a.start_time_label ?? '';
  const timeB = b.start_time_label ?? '';
  if (timeA !== timeB) {
    return timeA.localeCompare(timeB);
  }
  if (a.title !== b.title) {
    return a.title.localeCompare(b.title);
  }
  return a.occurrence_id.localeCompare(b.occurrence_id);
}

/**
 * Extrait la clé de jour locale `YYYY-MM-DD` et l'heure optionnelle `HH:mm` à partir du champ `due_date` d'une tâche.
 */
function extractTaskDueDayAndTime(task: TaskRecord): {
  dayKey: string;
  timeLabel: string | null;
} | null {
  if (!task.due_date || !task.due_date.trim()) {
    return null;
  }
  const raw = task.due_date.trim();

  // Format date locale simple `YYYY-MM-DD`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return { dayKey: raw, timeLabel: null };
  }

  // Format `YYYY-MM-DDTHH:mm` ou `YYYY-MM-DD HH:mm` sans fuseau
  const localTimeMatch = raw.match(
    /^(\d{4}-\d{2}-\d{2})[T\s](\d{2}:\d{2})(?::\d{2})?$/,
  );
  if (localTimeMatch) {
    return {
      dayKey: localTimeMatch[1],
      timeLabel: task.has_due_time ? localTimeMatch[2] : null,
    };
  }

  // Format ISO complet avec fuseau
  const parsedMs = Date.parse(raw);
  if (!Number.isNaN(parsedMs)) {
    const d = new Date(parsedMs);
    return {
      dayKey: toLocalDayKey(d),
      timeLabel: task.has_due_time ? toLocalTimeLabel(d) : null,
    };
  }

  const ymdPrefix = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymdPrefix)) {
    return { dayKey: ymdPrefix, timeLabel: null };
  }

  return null;
}

/**
 * Compare deux éléments de la timeline d'agenda (`AgendaTimelineItem`) :
 * 1. Par `day_key` croissant (`YYYY-MM-DD`)
 * 2. Éléments journée entière / sans heure en premier (`is_all_day === true`)
 * 3. Par heure (`time_label` croissant, ex. `'09:00'` avant `'14:30'`)
 * 4. À heure ou journée égale : `ics_event` avant `task_deadline`, puis par priorité décroissante (pour les tâches), puis par titre.
 */
export function compareAgendaTimelineItems(
  a: AgendaTimelineItem,
  b: AgendaTimelineItem,
): number {
  if (a.day_key !== b.day_key) {
    return a.day_key.localeCompare(b.day_key);
  }
  if (a.is_all_day !== b.is_all_day) {
    return a.is_all_day ? -1 : 1;
  }
  const timeA = a.time_label ?? '';
  const timeB = b.time_label ?? '';
  if (timeA !== timeB) {
    return timeA.localeCompare(timeB);
  }
  if (a.kind !== b.kind) {
    return a.kind === 'ics_event' ? -1 : 1;
  }
  if (a.kind === 'task_deadline' && b.kind === 'task_deadline') {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
  }
  return a.title.localeCompare(b.title);
}

/**
 * AGD-6 : Fusionne les événements d'agenda dépliés (`ExpandedCalendarEvent[]`) et les échéances
 * de tâches actives (`deleted_at === null && status !== 'cancelled'`) comprises dans `[rangeStartDate, rangeEndDate]`.
 * Distingue clairement chaque entrée via le discriminant `kind: 'ics_event' | 'task_deadline'`.
 */
export function mergeEventsAndTaskDeadlines(
  events: readonly ExpandedCalendarEvent[],
  tasks: readonly TaskRecord[],
  rangeStartDate: string,
  rangeEndDate: string,
): AgendaTimelineItem[] {
  const startBound = rangeStartDate.trim().slice(0, 10);
  const endBound = rangeEndDate.trim().slice(0, 10);
  if (!startBound || !endBound || startBound > endBound) {
    return [];
  }

  const timeline: AgendaTimelineItem[] = [];

  for (const evt of events) {
    if (evt.day_key < startBound || evt.day_key > endBound) {
      continue;
    }
    timeline.push({
      ...evt,
      kind: 'ics_event',
      readonly: true,
      time_label: evt.start_time_label,
    });
  }

  for (const task of tasks) {
    if (task.deleted_at !== null || task.status === 'cancelled') {
      continue;
    }
    const dueInfo = extractTaskDueDayAndTime(task);
    if (!dueInfo) {
      continue;
    }
    if (dueInfo.dayKey < startBound || dueInfo.dayKey > endBound) {
      continue;
    }

    const hasTime = Boolean(task.has_due_time && dueInfo.timeLabel);
    const timeLabel = hasTime ? dueInfo.timeLabel : null;

    timeline.push({
      kind: 'task_deadline',
      id: `deadline:${task.id}:${dueInfo.dayKey}`,
      occurrence_id: `deadline:${task.id}:${dueInfo.dayKey}`,
      task_id: task.id,
      title: task.title,
      notes: task.notes ?? '',
      day_key: dueInfo.dayKey,
      due_date: task.due_date!,
      has_due_time: hasTime,
      time_label: timeLabel,
      start_time_label: timeLabel,
      end_time_label: null,
      is_all_day: !hasTime,
      priority: task.priority,
      status: task.status,
      category_id: task.category_id,
      estimated_minutes: task.estimated_minutes,
      readonly: false,
    });
  }

  return timeline.sort(compareAgendaTimelineItems);
}

/**
 * Retourne le résumé complet de l'agenda (événements ICS + échéances de tâches) pour un jour donné `dayKey` (`YYYY-MM-DD`).
 */
export function getAgendaForDay(
  events: readonly CalendarEventRecord[],
  tasks: readonly TaskRecord[],
  dayKey: string,
): AgendaDaySummary {
  const cleanDay = dayKey.trim().slice(0, 10);
  const expanded = expandCalendarEventsForRange(events, cleanDay, cleanDay);
  const items = mergeEventsAndTaskDeadlines(
    expanded,
    tasks,
    cleanDay,
    cleanDay,
  );
  const icsEvents = items.filter(
    (item): item is AgendaIcsEventItem => item.kind === 'ics_event',
  );
  const deadlines = items.filter(
    (item): item is AgendaTaskDeadlineItem => item.kind === 'task_deadline',
  );

  return {
    dayKey: cleanDay,
    eventCount: icsEvents.length,
    deadlineCount: deadlines.length,
    totalCount: items.length,
    events: icsEvents,
    deadlines,
    items,
  };
}

/**
 * Construit un `Map<dayKey, { eventCount, deadlineCount, items }>` sur la plage `[rangeStartDate, rangeEndDate]`
 * pour alimenter la mini-grille "At-a-Glance" du Dashboard et les vues Semaine/Mois de l'écran Agenda.
 */
export function getDaysWithAgendaItems(
  events: readonly CalendarEventRecord[],
  tasks: readonly TaskRecord[],
  rangeStartDate: string,
  rangeEndDate: string,
): Map<
  string,
  { eventCount: number; deadlineCount: number; items: AgendaTimelineItem[] }
> {
  const startBound = rangeStartDate.trim().slice(0, 10);
  const endBound = rangeEndDate.trim().slice(0, 10);
  const map = new Map<
    string,
    { eventCount: number; deadlineCount: number; items: AgendaTimelineItem[] }
  >();

  if (!startBound || !endBound || startBound > endBound) {
    return map;
  }

  const expanded = expandCalendarEventsForRange(events, startBound, endBound);
  const merged = mergeEventsAndTaskDeadlines(
    expanded,
    tasks,
    startBound,
    endBound,
  );

  for (const item of merged) {
    const existing = map.get(item.day_key) ?? {
      eventCount: 0,
      deadlineCount: 0,
      items: [],
    };
    if (item.kind === 'ics_event') {
      existing.eventCount += 1;
    } else {
      existing.deadlineCount += 1;
    }
    existing.items.push(item);
    map.set(item.day_key, existing);
  }

  return map;
}

/**
 * Détermine si une source ICS doit être rafraîchie selon `refresh_interval_minutes` et `last_synced_at`.
 */
export function isCalendarSourceDueForSync(
  source: CalendarSourceRecord,
  now: Date = new Date(),
): boolean {
  if (!source.last_synced_at) {
    return true;
  }
  const lastSyncMs = Date.parse(source.last_synced_at);
  if (Number.isNaN(lastSyncMs)) {
    return true;
  }
  const intervalMs = Math.max(5, source.refresh_interval_minutes) * 60 * 1000;
  return now.getTime() - lastSyncMs >= intervalMs;
}

/**
 * AGD-1, AGD-4, AGD-5 : Synchronise une source ICS par son identifiant :
 * 1. Télécharge ou lit le contenu ICS brut via `fetchCalendarSourceIcs(sourceId)`
 * 2. Parse les événements et règles de récurrence via `parseIcsFeed`
 * 3. Remplace atomiquement le cache de cette source via `saveCalendarEventsForSource`
 * 4. En cas d'erreur réseau, fichier manquant ou ICS malformé, enregistre l'erreur via
 *    `recordCalendarSourceError` et **conserve intacts** les événements déjà présents en cache local (`AGD-5`).
 */
export async function syncCalendarSourceById(
  sourceId: string,
): Promise<CalendarSourceSyncResult> {
  try {
    const rawIcs = await fetchCalendarSourceIcs(sourceId);
    const parsedInputs = parseIcsFeed(rawIcs);
    const savedRecords = await saveCalendarEventsForSource(
      sourceId,
      parsedInputs,
    );
    return {
      sourceId,
      success: true,
      events: savedRecords,
      syncedCount: savedRecords.length,
      preservedOfflineCache: false,
      error: null,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Erreur lors de la synchronisation ICS.';
    try {
      await recordCalendarSourceError(sourceId, message);
    } catch {
      // Ignorer si la source elle-même n'existe plus
    }
    let cachedEvents: CalendarEventRecord[] = [];
    try {
      cachedEvents = await listCalendarEvents(sourceId);
    } catch {
      cachedEvents = [];
    }
    return {
      sourceId,
      success: false,
      events: cachedEvents,
      syncedCount: 0,
      preservedOfflineCache: cachedEvents.length > 0,
      error: message,
    };
  }
}

/**
 * Synchronise toutes les sources ICS configurées (ou uniquement celles dont le délai de rafraîchissement est échu).
 */
export async function syncAllCalendarSources(
  options: SyncAllCalendarSourcesOptions = {},
): Promise<SyncAllCalendarSourcesSummary> {
  const { onlyDue = false, now = new Date() } = options;
  const sources = await listCalendarSources();

  const results: CalendarSourceSyncResult[] = [];
  let syncedSourcesCount = 0;
  let failedSourcesCount = 0;
  let skippedSourcesCount = 0;

  for (const source of sources) {
    if (onlyDue && !isCalendarSourceDueForSync(source, now)) {
      skippedSourcesCount += 1;
      continue;
    }
    const res = await syncCalendarSourceById(source.id);
    results.push(res);
    if (res.success) {
      syncedSourcesCount += 1;
    } else {
      failedSourcesCount += 1;
    }
  }

  return {
    results,
    syncedSourcesCount,
    failedSourcesCount,
    skippedSourcesCount,
  };
}
