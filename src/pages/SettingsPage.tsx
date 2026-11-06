import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Database,
  Download,
  FolderOpen,
  HardDriveDownload,
  Lock,
  Monitor,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import {
  BackupFileInfo,
  CalendarSourceRecord,
  CalendarSourceType,
  DateFormat,
  DbStatus,
  createCalendarSource,
  deleteCalendarSource,
  exportFullJson,
  getCategories,
  getDbStatus,
  getSettingValue,
  listBackups,
  listCalendarSources,
  saveCalendarEventsForSource,
  setBackupDir,
  ThemeMode,
  triggerBackup,
} from '../lib/db';
import {
  parseIcsFeed,
  syncCalendarSourceById,
} from '../lib/calendar-engine';
import { formatTranslation, useTranslations } from '../i18n';

export const SettingsPage: React.FC = () => {
  const t = useTranslations();
  const {
    theme,
    resolvedTheme,
    setTheme,
    activePaletteId,
    setActivePaletteId,
    palettes,
    userName,
    setUserName,
    dateFormat,
    setDateFormat,
  } = useTheme();
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [categoryCount, setCategoryCount] = useState<number>(0);
  const [nameInput, setNameInput] = useState<string>(userName);
  const [backupDirInput, setBackupDirInput] = useState<string>('');
  const [backupFiles, setBackupFiles] = useState<BackupFileInfo[]>([]);
  const [backupStatusMessage, setBackupStatusMessage] = useState<string | null>(
    null,
  );
  const [exportedJsonPreview, setExportedJsonPreview] = useState<string | null>(
    null,
  );
  const [calendarSources, setCalendarSources] = useState<CalendarSourceRecord[]>(
    [],
  );
  const [icsSourceName, setIcsSourceName] = useState<string>('');
  const [icsSourceType, setIcsSourceType] = useState<CalendarSourceType>('file');
  const [icsSourceLocation, setIcsSourceLocation] = useState<string>('');
  const [icsRawContent, setIcsRawContent] = useState<string>('');
  const [icsRefreshInterval, setIcsRefreshInterval] = useState<number>(30);
  const [icsFeedbackMessage, setIcsFeedbackMessage] = useState<string | null>(
    null,
  );
  const [icsErrorMessage, setIcsErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setNameInput(userName);
  }, [userName]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getDbStatus(),
      getCategories(),
      getSettingValue<string>('backup_dir', ''),
      listBackups(),
      listCalendarSources(),
    ])
      .then(
        ([
          status,
          categories,
          currentBackupDir,
          currentBackups,
          loadedSources,
        ]) => {
          if (!mounted) return;
          setDbStatus(status);
          setCategoryCount(categories.length);
          setBackupDirInput(currentBackupDir);
          setBackupFiles(currentBackups);
          setCalendarSources(loadedSources);
        },
      )
      .catch(() => {
        if (!mounted) return;
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleIcsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setIcsSourceLocation(file.name);
    if (!icsSourceName.trim()) {
      setIcsSourceName(file.name.replace(/\.ics$/i, ''));
    }

    if (typeof file.text === 'function') {
      file
        .text()
        .then((content) => {
          setIcsRawContent(content);
        })
        .catch(() => {
          // ignore
        });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setIcsRawContent(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleAddCalendarSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setIcsErrorMessage(null);
    setIcsFeedbackMessage(null);

    try {
      const interval = Math.max(5, Number(icsRefreshInterval) || 30);
      const created = await createCalendarSource({
        name: icsSourceName,
        source_type: icsSourceType,
        location: icsSourceLocation,
        refresh_interval_minutes: interval,
        raw_ics_content:
          icsSourceType === 'file' && icsRawContent.trim()
            ? icsRawContent
            : undefined,
      });

      if (icsSourceType === 'file' && icsRawContent.trim()) {
        try {
          const parsed = parseIcsFeed(icsRawContent);
          await saveCalendarEventsForSource(created.id, parsed);
        } catch {
          await syncCalendarSourceById(created.id);
        }
      } else {
        await syncCalendarSourceById(created.id);
      }

      const refreshedSources = await listCalendarSources();
      setCalendarSources(refreshedSources);
      setIcsSourceName('');
      setIcsSourceLocation('');
      setIcsRawContent('');
      setIcsRefreshInterval(30);
      setIcsFeedbackMessage(t.settings.calendarSources.addedSuccessFeedback);
    } catch (err) {
      setIcsErrorMessage(
        err instanceof Error ? err.message : String(err),
      );
    }
  };

  const handleSyncCalendarSource = async (sourceId: string) => {
    setIcsErrorMessage(null);
    setIcsFeedbackMessage(null);
    await syncCalendarSourceById(sourceId);
    const refreshed = await listCalendarSources();
    setCalendarSources(refreshed);
    setIcsFeedbackMessage(t.settings.calendarSources.syncedSuccessFeedback);
  };

  const handleDeleteCalendarSource = async (sourceId: string) => {
    setIcsErrorMessage(null);
    setIcsFeedbackMessage(null);
    await deleteCalendarSource(sourceId);
    const refreshed = await listCalendarSources();
    setCalendarSources(refreshed);
    setIcsFeedbackMessage(t.settings.calendarSources.deletedSuccessFeedback);
  };

  const handleSaveBackupDir = async () => {
    const saved = await setBackupDir(backupDirInput);
    setBackupDirInput(saved);
    setBackupStatusMessage(t.settings.backup.dirSavedFeedback);
  };

  const handleTriggerBackup = async () => {
    await triggerBackup(true);
    const updatedList = await listBackups();
    setBackupFiles(updatedList);
    setBackupStatusMessage(t.settings.backup.backupSuccessFeedback);
  };

  const handleExportFullJson = async () => {
    const json = await exportFullJson();
    setExportedJsonPreview(json);
    setBackupStatusMessage(t.settings.backup.exportSuccessFeedback);
  };

  const themeOptions: Array<{
    mode: ThemeMode;
    label: string;
    hint: string;
    icon: React.ReactNode;
  }> = [
    {
      mode: 'light',
      label: t.settings.appearance.light,
      hint: t.settings.appearance.lightHint,
      icon: <Sun className="h-5 w-5" aria-hidden="true" />,
    },
    {
      mode: 'dark',
      label: t.settings.appearance.dark,
      hint: t.settings.appearance.darkHint,
      icon: <Moon className="h-5 w-5" aria-hidden="true" />,
    },
    {
      mode: 'system',
      label: t.settings.appearance.system,
      hint: t.settings.appearance.systemHint,
      icon: <Monitor className="h-5 w-5" aria-hidden="true" />,
    },
  ];

  const dateFormatOptions: Array<{
    format: DateFormat;
    label: string;
    hint: string;
  }> = [
    {
      format: 'DD-MM-YYYY',
      label: t.settings.dateFormat.ddmmyyyy,
      hint: t.settings.dateFormat.ddmmyyyyHint,
    },
    {
      format: 'YYYY-MM-DD',
      label: t.settings.dateFormat.yyyymmdd,
      hint: t.settings.dateFormat.yyyymmddHint,
    },
    {
      format: 'MM-DD-YYYY',
      label: t.settings.dateFormat.mmddyyyy,
      hint: t.settings.dateFormat.mmddyyyyHint,
    },
  ];

  return (
    <div data-testid="page-settings" className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-display font-bold tracking-tight text-primary">
          {t.settings.heading}
        </h1>
        <p className="text-sm text-secondary">{t.settings.description}</p>
      </header>

      <section
        data-testid="settings-coming-soon"
        className="rounded-3xl border border-subtle bg-surface p-6 flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <span className="inline-block rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-secondary mb-2">
            {t.settings.comingSoonBadge}
          </span>
          <p className="text-sm font-semibold text-primary">
            {t.settings.comingSoonTitle}
          </p>
        </div>
      </section>

      {/* Prénom personnalisé */}
      <section
        aria-labelledby="profile-heading"
        className="rounded-3xl border border-subtle bg-surface p-6"
      >
        <h2
          id="profile-heading"
          className="text-base font-display font-bold text-primary mb-1"
        >
          {t.settings.profile.title}
        </h2>
        <p className="text-sm text-secondary mb-4">
          {t.settings.profile.description}
        </p>
        <div className="flex flex-wrap items-center gap-3 max-w-md">
          <label htmlFor="settings-user-name" className="sr-only">
            {t.settings.profile.label}
          </label>
          <input
            id="settings-user-name"
            type="text"
            value={nameInput}
            placeholder={t.settings.profile.placeholder}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => {
              void setUserName(nameInput);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void setUserName(nameInput);
              }
            }}
            className="flex-1 rounded-full border border-subtle bg-surface-muted px-4 py-2 text-sm text-primary placeholder:text-muted"
          />
          <button
            type="button"
            onClick={() => {
              void setUserName(nameInput);
            }}
            className="rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-accent-foreground"
          >
            {t.app.save}
          </button>
        </div>
      </section>

      {/* Sélecteur de thème Clair / Sombre / Système (ACC-2) */}
      <section
        aria-labelledby="appearance-heading"
        className="rounded-3xl border border-subtle bg-surface p-6"
      >
        <div className="mb-4">
          <h2
            id="appearance-heading"
            className="text-base font-display font-bold text-primary"
          >
            {t.settings.appearance.title}
          </h2>
          <p className="text-sm text-secondary">
            {t.settings.appearance.description}
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label={t.settings.appearance.groupLabel}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"
        >
          {themeOptions.map((option) => {
            const isSelected = theme === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`theme-option-${option.mode}`}
                onClick={() => {
                  void setTheme(option.mode);
                }}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-accent-primary bg-surface-muted text-primary'
                    : 'border-subtle bg-surface text-secondary hover:bg-surface-muted'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                  {option.icon}
                  <span>{option.label}</span>
                </div>
                <span className="text-xs text-secondary">{option.hint}</span>
              </button>
            );
          })}
        </div>

        {/* Sélecteur de palette intégrée */}
        <div
          role="radiogroup"
          aria-label={t.settings.appearance.paletteGroupLabel}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {palettes.map((palette) => {
            const isSelected = activePaletteId === palette.id;
            return (
              <button
                key={palette.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`palette-option-${palette.id}`}
                onClick={() => {
                  void setActivePaletteId(palette.id);
                }}
                className={`flex items-center justify-between gap-2 rounded-2xl border p-3.5 text-left transition-colors ${
                  isSelected
                    ? 'border-accent-primary bg-surface-muted text-primary'
                    : 'border-subtle bg-surface text-secondary hover:bg-surface-muted'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Palette className="h-4 w-4" aria-hidden="true" />
                  {palette.name}
                </span>
              </button>
            );
          })}
        </div>

        <p
          data-testid="active-theme-indicator"
          className="mt-4 text-xs font-medium text-secondary"
        >
          {t.settings.appearance.activeTheme} <span className="font-mono">{theme}</span> (
          <span className="font-mono">{resolvedTheme}</span>)
        </p>
      </section>

      {/* Sélecteur de format de date (DD-MM-YYYY par défaut, YYYY-MM-DD, MM-DD-YYYY) */}
      <section
        aria-labelledby="date-format-heading"
        data-testid="settings-date-format-section"
        className="rounded-3xl border border-subtle bg-surface p-6"
      >
        <div className="mb-4">
          <h2
            id="date-format-heading"
            className="text-base font-display font-bold text-primary"
          >
            {t.settings.dateFormat.title}
          </h2>
          <p className="text-sm text-secondary">
            {t.settings.dateFormat.description}
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label={t.settings.dateFormat.groupLabel}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          {dateFormatOptions.map((option) => {
            const isSelected = dateFormat === option.format;
            return (
              <button
                key={option.format}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`date-format-option-${option.format}`}
                onClick={() => {
                  void setDateFormat(option.format);
                }}
                className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-accent-primary bg-surface-muted text-primary'
                    : 'border-subtle bg-surface text-secondary hover:bg-surface-muted'
                }`}
              >
                <div className="flex items-center gap-2 font-semibold text-sm text-primary">
                  <Calendar className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>{option.label}</span>
                </div>
                <span className="text-xs text-secondary">{option.hint}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Sources d'agenda ICS (AGD-1, PRV-3, AGD-5) */}
      <section
        aria-labelledby="calendar-sources-heading"
        data-testid="settings-calendar-sources-section"
        className="rounded-3xl border border-subtle bg-surface p-6 flex flex-col gap-5"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2
              id="calendar-sources-heading"
              className="text-base font-display font-bold text-primary"
            >
              {t.settings.calendarSources.title}
            </h2>
          </div>
          <p className="text-sm text-secondary">
            {t.settings.calendarSources.description}
          </p>
        </div>

        <form
          onSubmit={(e) => {
            void handleAddCalendarSource(e);
          }}
          className="flex flex-col gap-4 rounded-2xl border border-subtle bg-surface-muted p-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="settings-ics-source-name"
                className="text-xs font-semibold text-secondary"
              >
                {t.settings.calendarSources.nameLabel}
              </label>
              <input
                id="settings-ics-source-name"
                type="text"
                data-testid="settings-ics-name-input"
                value={icsSourceName}
                placeholder={t.settings.calendarSources.namePlaceholder}
                onChange={(e) => setIcsSourceName(e.target.value)}
                className="rounded-full border border-subtle bg-surface px-4 py-2 text-xs text-primary placeholder:text-muted"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">
                {t.settings.calendarSources.typeLabel}
              </span>
              <div className="inline-flex rounded-full border border-subtle bg-surface p-1 self-start">
                <button
                  type="button"
                  data-testid="settings-ics-type-file"
                  aria-pressed={icsSourceType === 'file'}
                  onClick={() => setIcsSourceType('file')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    icsSourceType === 'file'
                      ? 'bg-accent-primary text-accent-foreground'
                      : 'text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {t.settings.calendarSources.typeFile}
                </button>
                <button
                  type="button"
                  data-testid="settings-ics-type-url"
                  aria-pressed={icsSourceType === 'url'}
                  onClick={() => setIcsSourceType('url')}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    icsSourceType === 'url'
                      ? 'bg-accent-primary text-accent-foreground'
                      : 'text-secondary hover:bg-surface-muted'
                  }`}
                >
                  {t.settings.calendarSources.typeUrl}
                </button>
              </div>
            </div>
          </div>

          {icsSourceType === 'file' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="settings-ics-file-input"
                  className="text-xs font-semibold text-secondary flex items-center gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t.settings.calendarSources.fileUploadLabel}</span>
                </label>
                <input
                  id="settings-ics-file-input"
                  type="file"
                  accept=".ics,text/calendar"
                  data-testid="settings-ics-file-input"
                  onChange={handleIcsFileUpload}
                  className="rounded-full border border-subtle bg-surface px-3 py-1.5 text-xs text-primary"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="settings-ics-location-file"
                  className="text-xs font-semibold text-secondary"
                >
                  {t.settings.calendarSources.filePathLabel}
                </label>
                <input
                  id="settings-ics-location-file"
                  type="text"
                  data-testid="settings-ics-location-input"
                  value={icsSourceLocation}
                  placeholder={t.settings.calendarSources.filePathPlaceholder}
                  onChange={(e) => setIcsSourceLocation(e.target.value)}
                  className="rounded-full border border-subtle bg-surface px-4 py-2 text-xs text-primary placeholder:text-muted font-mono"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <label
                  htmlFor="settings-ics-location-url"
                  className="text-xs font-semibold text-secondary"
                >
                  {t.settings.calendarSources.urlLabel}
                </label>
                <input
                  id="settings-ics-location-url"
                  type="text"
                  data-testid="settings-ics-location-input"
                  value={icsSourceLocation}
                  placeholder={t.settings.calendarSources.urlPlaceholder}
                  onChange={(e) => setIcsSourceLocation(e.target.value)}
                  className="rounded-full border border-subtle bg-surface px-4 py-2 text-xs text-primary placeholder:text-muted font-mono"
                />
                <span
                  data-testid="settings-ics-keychain-notice"
                  className="inline-flex items-center gap-1.5 text-[11px] font-medium text-secondary mt-0.5"
                >
                  <Lock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{t.settings.calendarSources.keychainNotice}</span>
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="settings-ics-interval"
                  className="text-xs font-semibold text-secondary"
                >
                  {t.settings.calendarSources.refreshIntervalLabel}
                </label>
                <input
                  id="settings-ics-interval"
                  type="number"
                  min={5}
                  data-testid="settings-ics-interval-input"
                  value={icsRefreshInterval}
                  onChange={(e) =>
                    setIcsRefreshInterval(Number(e.target.value))
                  }
                  className="rounded-full border border-subtle bg-surface px-4 py-2 text-xs text-primary font-mono"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end">
            <button
              type="submit"
              data-testid="settings-add-ics-source-btn"
              className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-5 py-2 text-xs font-semibold text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.calendarSources.addButton}</span>
            </button>
          </div>
        </form>

        {icsErrorMessage && (
          <p
            role="alert"
            data-testid="settings-ics-error-msg"
            className="text-xs font-semibold text-danger"
          >
            {icsErrorMessage}
          </p>
        )}

        {icsFeedbackMessage && (
          <p
            role="status"
            data-testid="settings-ics-status-msg"
            className="text-xs font-semibold text-primary"
          >
            {icsFeedbackMessage}
          </p>
        )}

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-secondary mb-3">
            {t.settings.calendarSources.configuredSourcesHeading} (
            {calendarSources.length})
          </h3>

          {calendarSources.length === 0 ? (
            <p
              data-testid="settings-ics-empty"
              className="text-xs text-secondary"
            >
              {t.settings.calendarSources.emptySources}
            </p>
          ) : (
            <ul
              data-testid="settings-ics-sources-list"
              className="divide-y divide-subtle rounded-2xl border border-subtle bg-surface-muted px-4 py-2"
            >
              {calendarSources.map((src) => (
                <li
                  key={src.id}
                  data-testid={`settings-ics-source-item-${src.id}`}
                  className="flex flex-col gap-2 py-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-primary">
                        {src.name}
                      </span>
                      <span className="rounded-full border border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-medium text-secondary">
                        {src.source_type === 'url'
                          ? t.settings.calendarSources.typeBadgeUrl
                          : t.settings.calendarSources.typeBadgeFile}
                      </span>
                      <span className="rounded-full border border-subtle bg-surface px-2.5 py-0.5 text-[11px] font-mono text-secondary">
                        {formatTranslation(
                          t.settings.calendarSources.intervalBadge,
                          { minutes: src.refresh_interval_minutes },
                        )}
                      </span>
                      <span className="text-[11px] text-secondary">
                        {t.settings.calendarSources.lastSyncedLabel}{' '}
                        {src.last_synced_at
                          ? src.last_synced_at.slice(0, 16).replace('T', ' ')
                          : t.settings.calendarSources.neverSynced}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        data-testid={`settings-sync-source-btn-${src.id}`}
                        onClick={() => {
                          void handleSyncCalendarSource(src.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-subtle bg-surface px-3 py-1 text-xs font-semibold text-primary hover:bg-surface-muted transition-colors"
                      >
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                        <span>{t.settings.calendarSources.syncButton}</span>
                      </button>
                      <button
                        type="button"
                        data-testid={`settings-delete-source-btn-${src.id}`}
                        onClick={() => {
                          void handleDeleteCalendarSource(src.id);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-subtle bg-surface px-3 py-1 text-xs font-semibold text-danger hover:bg-surface-muted transition-colors"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden="true" />
                        <span>{t.settings.calendarSources.deleteButton}</span>
                      </button>
                    </div>
                  </div>

                  {src.last_error && (
                    <div
                      role="alert"
                      data-testid={`settings-source-error-${src.id}`}
                      className="flex flex-col gap-0.5 rounded-xl border border-danger bg-surface px-3 py-2 text-[11px] text-danger"
                    >
                      <div className="flex items-center gap-1.5 font-semibold">
                        <AlertTriangle
                          className="h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{src.last_error}</span>
                      </div>
                      <span className="text-secondary">
                        {t.settings.calendarSources.offlineCacheNotice}
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Sauvegardes automatiques & Export de données (BKP-1, BKP-2, BKP-3) */}
      <section
        aria-labelledby="backup-heading"
        data-testid="settings-backup-section"
        className="rounded-3xl border border-subtle bg-surface p-6 flex flex-col gap-5"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Database className="h-4 w-4 text-primary" aria-hidden="true" />
            <h2
              id="backup-heading"
              className="text-base font-display font-bold text-primary"
            >
              {t.settings.backup.title}
            </h2>
          </div>
          <p className="text-sm text-secondary">
            {t.settings.backup.description}
          </p>
          <p
            data-testid="settings-backup-rotation-policy"
            className="text-xs font-medium text-secondary mt-1"
          >
            {t.settings.backup.rotationPolicy}
          </p>
        </div>

        {/* Dossier de destination des sauvegardes (BKP-2) */}
        <div className="flex flex-col gap-2">
          <label
            htmlFor="settings-backup-dir"
            className="text-xs font-semibold text-secondary flex items-center gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t.settings.backup.dirLabel}</span>
          </label>
          <div className="flex flex-wrap items-center gap-3 max-w-xl">
            <input
              id="settings-backup-dir"
              type="text"
              data-testid="settings-backup-dir-input"
              value={backupDirInput}
              placeholder={t.settings.backup.dirPlaceholder}
              onChange={(e) => setBackupDirInput(e.target.value)}
              className="flex-1 rounded-full border border-subtle bg-surface-muted px-4 py-2 text-xs text-primary placeholder:text-muted font-mono"
            />
            <button
              type="button"
              data-testid="settings-backup-dir-save"
              onClick={() => {
                void handleSaveBackupDir();
              }}
              className="rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-accent-foreground"
            >
              {t.app.save}
            </button>
          </div>
        </div>

        {/* Actions de sauvegarde immédiate (BKP-1) et d'export JSON complet (BKP-3) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-subtle">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              data-testid="settings-trigger-backup-btn"
              onClick={() => {
                void handleTriggerBackup();
              }}
              className="inline-flex items-center gap-2 rounded-full bg-accent-primary px-4 py-2 text-xs font-semibold text-accent-foreground"
            >
              <HardDriveDownload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.backup.triggerBackupBtn}</span>
            </button>

            <button
              type="button"
              data-testid="settings-export-json-btn"
              onClick={() => {
                void handleExportFullJson();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-subtle bg-surface-muted px-4 py-2 text-xs font-semibold text-primary hover:bg-surface transition-colors"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t.settings.backup.exportJsonBtn}</span>
            </button>
          </div>

          <span
            data-testid="settings-backups-count"
            className="text-xs font-medium text-secondary"
          >
            {t.settings.backup.availableBackupsLabel} :{' '}
            <strong className="text-primary">{backupFiles.length}</strong>
          </span>
        </div>

        {backupStatusMessage && (
          <p
            role="status"
            data-testid="settings-backup-status-msg"
            className="text-xs font-semibold text-primary"
          >
            {backupStatusMessage}
          </p>
        )}

        {backupFiles.length > 0 && (
          <ul
            data-testid="settings-backups-list"
            className="divide-y divide-subtle rounded-2xl border border-subtle bg-surface-muted px-4 py-2 text-xs"
          >
            {backupFiles.map((file) => (
              <li
                key={file.filename}
                className="flex items-center justify-between gap-2 py-1.5"
              >
                <span className="font-mono font-semibold text-primary">
                  {file.filename}
                </span>
                <span className="text-secondary text-[11px] uppercase">
                  {file.kind}
                </span>
              </li>
            ))}
          </ul>
        )}

        {exportedJsonPreview && (
          <div
            data-testid="settings-export-json-preview"
            className="rounded-2xl border border-subtle bg-surface-muted p-4 flex flex-col gap-2"
          >
            <p className="text-xs font-semibold text-primary">
              {t.settings.backup.exportJsonTitle}
            </p>
            <pre className="max-h-48 overflow-y-auto text-[11px] font-mono text-secondary whitespace-pre-wrap break-all">
              {exportedJsonPreview}
            </pre>
          </div>
        )}
      </section>

      {/* État du socle SQLite local-first */}
      <section
        aria-labelledby="storage-heading"
        className="rounded-3xl border border-subtle bg-surface p-6"
      >
        <h2
          id="storage-heading"
          className="text-base font-display font-bold text-primary mb-3"
        >
          {t.settings.storage.title}
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl bg-surface-muted p-4">
            <dt className="text-xs text-secondary">
              {t.settings.storage.schemaVersion}
            </dt>
            <dd className="font-semibold text-primary">
              v{dbStatus?.schema_version ?? 4}
            </dd>
          </div>
          <div className="rounded-2xl bg-surface-muted p-4">
            <dt className="text-xs text-secondary">
              {t.settings.storage.categoriesCount}
            </dt>
            <dd className="font-semibold text-primary">{categoryCount}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-secondary">
          {t.settings.storage.syncReady}
        </p>
      </section>
    </div>
  );
};
