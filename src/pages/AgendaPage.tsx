import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Lock,
  MapPin,
  RefreshCw,
  Repeat,
  X,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslations } from '../i18n';
import {
  AgendaTimelineItem,
  getDaysWithAgendaItems,
  syncAllCalendarSources,
} from '../lib/calendar-engine';
import {
  CalendarEventRecord,
  CalendarSourceRecord,
  TaskRecord,
  listCalendarEvents,
  listCalendarSources,
  listTasks,
} from '../lib/db';
import { formatDateByPreference } from '../lib/quick-parser';

const REFERENCE_TODAY = '2026-11-02';

interface GridDayCell {
  dayKey: string;
  dayNumber: number;
  inCurrentMonth: boolean;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function buildYmd(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${pad2(month)}-${pad2(day)}`;
}

function parseYmd(dayKey: string): { year: number; month: number; day: number } {
  const [y, m, d] = dayKey.split('-').map(Number);
  return {
    year: y || 2026,
    month: m || 11,
    day: d || 2,
  };
}

function addDaysYmd(dayKey: string, delta: number): string {
  const { year, month, day } = parseYmd(dayKey);
  const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return buildYmd(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

function addMonthsYmd(dayKey: string, deltaMonths: number): string {
  const { year, month, day } = parseYmd(dayKey);
  const targetFirst = new Date(Date.UTC(year, month - 1 + deltaMonths, 1, 12, 0, 0));
  const ty = targetFirst.getUTCFullYear();
  const tm = targetFirst.getUTCMonth() + 1;
  const maxDays = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  return buildYmd(ty, tm, Math.min(day, maxDays));
}

function buildAgendaGridDays(
  anchorDayKey: string,
  viewMode: 'week' | 'month',
): GridDayCell[] {
  const { year, month, day } = parseYmd(anchorDayKey);

  if (viewMode === 'week') {
    const dt = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    const dowMondayZero = (dt.getUTCDay() + 6) % 7;
    const mondayKey = addDaysYmd(anchorDayKey, -dowMondayZero);
    const cells: GridDayCell[] = [];
    for (let i = 0; i < 7; i += 1) {
      const k = addDaysYmd(mondayKey, i);
      const parsed = parseYmd(k);
      cells.push({
        dayKey: k,
        dayNumber: parsed.day,
        inCurrentMonth: parsed.month === month,
      });
    }
    return cells;
  }

  const firstDayKey = buildYmd(year, month, 1);
  const firstDateUtc = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0));
  const firstDowMondayZero = (firstDateUtc.getUTCDay() + 6) % 7;
  const startGridKey = addDaysYmd(firstDayKey, -firstDowMondayZero);

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const totalNeeded = firstDowMondayZero + daysInMonth;
  const cellCount = totalNeeded > 35 ? 42 : 35;

  const cells: GridDayCell[] = [];
  for (let i = 0; i < cellCount; i += 1) {
    const k = addDaysYmd(startGridKey, i);
    const parsed = parseYmd(k);
    cells.push({
      dayKey: k,
      dayNumber: parsed.day,
      inCurrentMonth: parsed.month === month && parsed.year === year,
    });
  }
  return cells;
}

function formatPeriodHeaderLabel(
  anchorDayKey: string,
  viewMode: 'week' | 'month',
  gridDays: GridDayCell[],
): string {
  const { year, month } = parseYmd(anchorDayKey);
  if (viewMode === 'month') {
    const dt = new Date(year, month - 1, 1);
    const formatted = new Intl.DateTimeFormat('fr-FR', {
      month: 'long',
      year: 'numeric',
    }).format(dt);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  const firstKey = gridDays[0]?.dayKey ?? anchorDayKey;
  const lastKey = gridDays[gridDays.length - 1]?.dayKey ?? anchorDayKey;
  const f = parseYmd(firstKey);
  const l = parseYmd(lastKey);
  const firstDt = new Date(f.year, f.month - 1, f.day);
  const lastDt = new Date(l.year, l.month - 1, l.day);
  const fStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(firstDt);
  const lStr = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(lastDt);
  return `${fStr} – ${lStr}`;
}

function formatTimelineItemTimeRange(
  item: AgendaTimelineItem,
  allDayLabel: string,
): string {
  if (item.is_all_day) {
    return allDayLabel;
  }
  if (item.kind === 'ics_event') {
    if (item.start_time_label && item.end_time_label) {
      return `${item.start_time_label} – ${item.end_time_label}`;
    }
    return item.start_time_label ?? allDayLabel;
  }
  return item.time_label ?? allDayLabel;
}

export const AgendaPage: React.FC = () => {
  const t = useTranslations();
  const { dateFormat } = useTheme();

  const [viewMode, setViewMode] = useState<'week' | 'month'>('week');
  const [anchorDate, setAnchorDate] = useState<string>(REFERENCE_TODAY);
  const [events, setEvents] = useState<CalendarEventRecord[]>([]);
  const [sources, setSources] = useState<CalendarSourceRecord[]>([]);
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [selectedItem, setSelectedItem] = useState<AgendaTimelineItem | null>(
    null,
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const loadAgendaData = useCallback(async () => {
    const [loadedEvents, loadedSources, loadedTasks] = await Promise.all([
      listCalendarEvents(),
      listCalendarSources(),
      listTasks(),
    ]);
    setEvents(loadedEvents);
    setSources(loadedSources);
    setTasks(loadedTasks);
  }, []);

  useEffect(() => {
    void loadAgendaData();
  }, [loadAgendaData]);

  const handleSyncNow = async () => {
    setIsSyncing(true);
    try {
      await syncAllCalendarSources({ onlyDue: false });
      await loadAgendaData();
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePrevPeriod = () => {
    setAnchorDate((prev) =>
      viewMode === 'week' ? addDaysYmd(prev, -7) : addMonthsYmd(prev, -1),
    );
  };

  const handleNextPeriod = () => {
    setAnchorDate((prev) =>
      viewMode === 'week' ? addDaysYmd(prev, 7) : addMonthsYmd(prev, 1),
    );
  };

  const handleToday = () => {
    setAnchorDate(REFERENCE_TODAY);
  };

  const gridDays = useMemo(
    () => buildAgendaGridDays(anchorDate, viewMode),
    [anchorDate, viewMode],
  );

  const rangeStart = gridDays[0]?.dayKey ?? anchorDate;
  const rangeEnd = gridDays[gridDays.length - 1]?.dayKey ?? anchorDate;

  const daysMap = useMemo(
    () => getDaysWithAgendaItems(events, tasks, rangeStart, rangeEnd),
    [events, tasks, rangeStart, rangeEnd],
  );

  const sourceById = useMemo(
    () => new Map<string, CalendarSourceRecord>(sources.map((s) => [s.id, s])),
    [sources],
  );

  const periodLabel = useMemo(
    () => formatPeriodHeaderLabel(anchorDate, viewMode, gridDays),
    [anchorDate, viewMode, gridDays],
  );

  return (
    <div data-testid="page-agenda" className="flex flex-col gap-6 h-full">
      {/* Barre d'outils supérieure */}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-display font-bold tracking-tight text-primary">
              {t.agenda.heading}
            </h1>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface-muted px-3 py-1 text-xs font-medium text-secondary">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.agenda.readonlyBadge}</span>
            </span>
          </div>
          <p className="text-sm text-secondary">{t.agenda.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Contrôles de navigation temporelle */}
          <div className="inline-flex items-center gap-1 rounded-full border border-subtle bg-surface p-1">
            <button
              type="button"
              data-testid="agenda-prev-btn"
              aria-label={t.agenda.prevPeriodAria}
              onClick={handlePrevPeriod}
              className="rounded-full p-1.5 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="agenda-today-btn"
              onClick={handleToday}
              className="rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
            >
              {t.agenda.todayButton}
            </button>
            <button
              type="button"
              data-testid="agenda-next-btn"
              aria-label={t.agenda.nextPeriodAria}
              onClick={handleNextPeriod}
              className="rounded-full p-1.5 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <span
            data-testid="agenda-period-label"
            className="text-sm font-display font-bold text-primary px-2"
          >
            {periodLabel}
          </span>

          {/* Bouton Actualiser */}
          <button
            type="button"
            data-testid="agenda-sync-now-btn"
            disabled={isSyncing}
            onClick={() => {
              void handleSyncNow();
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface px-4 py-2 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span>
              {isSyncing ? t.agenda.syncingButton : t.agenda.syncNowButton}
            </span>
          </button>

          {/* Bascule Semaine / Mois en un clic (AGD-2) */}
          <div className="inline-flex rounded-full border border-subtle bg-surface p-1">
            <button
              type="button"
              data-testid="agenda-view-week"
              aria-pressed={viewMode === 'week'}
              onClick={() => setViewMode('week')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'week'
                  ? 'bg-accent-primary text-accent-foreground'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              {t.agenda.viewWeek}
            </button>
            <button
              type="button"
              data-testid="agenda-view-month"
              aria-pressed={viewMode === 'month'}
              onClick={() => setViewMode('month')}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === 'month'
                  ? 'bg-accent-primary text-accent-foreground'
                  : 'text-secondary hover:bg-surface-muted'
              }`}
            >
              {t.agenda.viewMonth}
            </button>
          </div>
        </div>
      </header>

      {/* Mise en page à 2 colonnes : Grille Semaine/Mois (8 col) + Panneau de détail en lecture seule (4 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1">
        {/* Grille principale */}
        <section
          data-testid={`agenda-grid-${viewMode}`}
          className="focus-card-surface lg:col-span-8 rounded-3xl p-5 flex flex-col gap-3"
        >
          {/* En-tête des jours de la semaine */}
          <div className="grid grid-cols-7 gap-2 border-b border-subtle pb-2">
            {t.agenda.weekdaysShort.map((weekday, idx) => (
              <div
                key={idx}
                className="text-xs font-display font-bold text-secondary text-center"
              >
                {weekday}
              </div>
            ))}
          </div>

          {/* Cellules des jours */}
          <div
            className={`grid grid-cols-7 gap-2 flex-1 ${
              viewMode === 'week' ? 'min-h-[360px]' : ''
            }`}
          >
            {gridDays.map((cell) => {
              const dayData = daysMap.get(cell.dayKey);
              const items = dayData?.items ?? [];
              const isToday = cell.dayKey === REFERENCE_TODAY;

              return (
                <div
                  key={cell.dayKey}
                  data-testid={`agenda-day-cell-${cell.dayKey}`}
                  className={`flex flex-col rounded-2xl border p-2.5 transition-colors ${
                    isToday
                      ? 'border-accent-primary bg-surface-muted'
                      : cell.inCurrentMonth
                        ? 'border-subtle bg-surface'
                        : 'border-subtle bg-surface opacity-60'
                  } ${viewMode === 'week' ? 'min-h-[320px]' : 'min-h-[104px]'}`}
                >
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isToday
                          ? 'bg-accent-primary text-accent-foreground'
                          : 'text-primary'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>
                    {items.length > 0 && (
                      <span className="text-[10px] font-semibold text-secondary">
                        {items.length}
                      </span>
                    )}
                  </div>

                  {items.length === 0 ? (
                    viewMode === 'week' ? (
                      <p className="text-[11px] text-muted mt-2">
                        {t.agenda.emptyDay}
                      </p>
                    ) : null
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {items.map((item) => {
                        const isSelected =
                          selectedItem?.occurrence_id === item.occurrence_id;
                        const isDeadline = item.kind === 'task_deadline';

                        return (
                          <li key={item.occurrence_id}>
                            <button
                              type="button"
                              data-testid={`agenda-item-${item.occurrence_id}`}
                              data-item-kind={item.kind}
                              onClick={() => setSelectedItem(item)}
                              className={`w-full text-left rounded-xl p-2 text-xs transition-colors flex flex-col gap-0.5 ${
                                isDeadline
                                  ? 'border border-dashed border-accent-primary bg-surface-muted text-primary'
                                  : 'border border-subtle bg-surface-muted text-primary'
                              } ${
                                isSelected
                                  ? 'ring-2 ring-accent-primary'
                                  : 'hover:opacity-90'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono text-[10px] font-semibold text-secondary truncate">
                                  {formatTimelineItemTimeRange(
                                    item,
                                    t.agenda.allDay,
                                  )}
                                </span>
                                {isDeadline ? (
                                  <span
                                    data-testid={`agenda-deadline-badge-${item.task_id}`}
                                    className="inline-flex items-center gap-0.5 rounded-full bg-surface px-1.5 py-0.5 text-[9px] font-bold text-primary shrink-0"
                                  >
                                    <Clock
                                      className="h-2.5 w-2.5"
                                      aria-hidden="true"
                                    />
                                    <span>{t.agenda.deadlineBadge}</span>
                                  </span>
                                ) : (
                                  <Lock
                                    className="h-2.5 w-2.5 text-secondary shrink-0"
                                    aria-hidden="true"
                                  />
                                )}
                              </div>
                              <span className="font-semibold text-primary line-clamp-2">
                                {item.title}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* Panneau latéral de détail en lecture seule (AGD-3) */}
        <aside
          data-testid="agenda-event-detail-panel"
          aria-label={t.agenda.detailPanel.heading}
          className="focus-card-surface lg:col-span-4 rounded-3xl p-6 flex flex-col justify-between"
        >
          {!selectedItem ? (
            <div className="my-auto flex flex-col items-center text-center px-4 py-8">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-subtle bg-surface-muted text-secondary mb-3">
                <Calendar className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-display font-bold text-primary mb-1">
                {t.agenda.detailPanel.emptySelectionTitle}
              </h2>
              <p className="text-xs text-secondary leading-relaxed">
                {t.agenda.detailPanel.emptySelectionDescription}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    data-testid="agenda-detail-readonly-badge"
                    className="inline-flex items-center gap-1.5 rounded-full border border-subtle bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary"
                  >
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    <span>{t.agenda.detailPanel.readonlyNotice}</span>
                  </span>
                  {selectedItem.kind === 'task_deadline' && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-accent-primary bg-surface-muted px-2.5 py-1 text-xs font-semibold text-primary">
                      <Clock className="h-3 w-3" aria-hidden="true" />
                      <span>{t.agenda.detailPanel.deadlineNotice}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="agenda-detail-close-btn"
                  aria-label={t.agenda.detailPanel.closeAria}
                  onClick={() => setSelectedItem(null)}
                  className="rounded-full p-1.5 text-secondary hover:bg-surface-muted hover:text-primary transition-colors"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div>
                <h2
                  data-testid="agenda-detail-title"
                  className="text-xl font-display font-bold text-primary break-words"
                >
                  {selectedItem.title}
                </h2>
              </div>

              <dl className="flex flex-col gap-4 text-xs">
                <div className="rounded-2xl border border-subtle bg-surface-muted p-3.5">
                  <dt className="font-semibold text-secondary flex items-center gap-1.5 mb-1">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.agenda.detailPanel.dateAndTimeLabel}</span>
                  </dt>
                  <dd
                    data-testid="agenda-detail-datetime"
                    className="font-semibold text-primary"
                  >
                    {formatDateByPreference(selectedItem.day_key, dateFormat)} ·{' '}
                    {formatTimelineItemTimeRange(
                      selectedItem,
                      t.agenda.allDay,
                    )}
                  </dd>
                </div>

                {selectedItem.kind === 'ics_event' && (
                  <div className="rounded-2xl border border-subtle bg-surface-muted p-3.5">
                    <dt className="font-semibold text-secondary flex items-center gap-1.5 mb-1">
                      <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.agenda.detailPanel.locationLabel}</span>
                    </dt>
                    <dd
                      data-testid="agenda-detail-location"
                      className="text-primary break-words"
                    >
                      {selectedItem.location.trim()
                        ? selectedItem.location
                        : t.agenda.detailPanel.noLocation}
                    </dd>
                  </div>
                )}

                <div className="rounded-2xl border border-subtle bg-surface-muted p-3.5">
                  <dt className="font-semibold text-secondary flex items-center gap-1.5 mb-1">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t.agenda.detailPanel.notesLabel}</span>
                  </dt>
                  <dd
                    data-testid="agenda-detail-notes"
                    className="text-primary whitespace-pre-wrap break-words"
                  >
                    {selectedItem.notes.trim()
                      ? selectedItem.notes
                      : t.agenda.detailPanel.noNotes}
                  </dd>
                </div>

                {selectedItem.kind === 'ics_event' && (
                  <div className="rounded-2xl border border-subtle bg-surface-muted p-3.5">
                    <dt className="font-semibold text-secondary flex items-center gap-1.5 mb-1">
                      <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{t.agenda.detailPanel.sourceLabel}</span>
                    </dt>
                    <dd
                      data-testid="agenda-detail-source"
                      className="font-semibold text-primary"
                    >
                      {sourceById.get(selectedItem.source_id)?.name ??
                        t.agenda.detailPanel.unknownSource}
                    </dd>
                    {selectedItem.is_recurring && (
                      <p
                        data-testid="agenda-detail-recurring"
                        className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-secondary"
                      >
                        <Repeat className="h-3 w-3" aria-hidden="true" />
                        <span>{t.agenda.detailPanel.recurringYes}</span>
                      </p>
                    )}
                  </div>
                )}
              </dl>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
