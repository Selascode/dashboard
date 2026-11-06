-- ============================================================================
-- Migration 003 : Format de date d'échéance, État du panneau Quick Capture & Mode Briefing
-- Règles : Clés settings date_format, quick_capture_panel_collapsed, briefing_mode
-- ============================================================================

INSERT OR IGNORE INTO settings (key, value_json, updated_at)
VALUES
    ('date_format', '"DD-MM-YYYY"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('quick_capture_panel_collapsed', 'false', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('briefing_mode', '"first_open"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));
