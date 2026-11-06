-- ============================================================================
-- Migration 004 : Paramètres de Sauvegarde Automatique & Rotation [BKP-1, BKP-2]
-- Règles : Clés settings backup_dir, last_auto_backup_date
-- ============================================================================

INSERT OR IGNORE INTO settings (key, value_json, updated_at)
VALUES
    ('backup_dir', '""', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('last_auto_backup_date', 'null', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
