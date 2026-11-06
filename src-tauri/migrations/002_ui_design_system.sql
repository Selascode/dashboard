-- ============================================================================
-- Migration 002 : Fondations Design System, Palettes Dynamiques & Catégories
-- Règles : Clés settings theme, active_palette, custom_palettes, user_name
--          Tokens de couleurs de catégories (--cat-1 à --cat-5)
-- ============================================================================

INSERT OR IGNORE INTO settings (key, value_json, updated_at)
VALUES
    ('theme', '"system"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('active_palette', '"coolors-classic"', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('custom_palettes', '[]', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    ('user_name', '""', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'));

-- Mise à jour des couleurs des 5 catégories par défaut vers les tokens --cat-1 à --cat-5
UPDATE categories SET color = '--cat-1', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'cat-inbox' AND color = '#64748b';
UPDATE categories SET color = '--cat-2', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'cat-ecole' AND color = '#3b82f6';
UPDATE categories SET color = '--cat-3', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'cat-sport' AND color = '#10b981';
UPDATE categories SET color = '--cat-4', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'cat-perso' AND color = '#f59e0b';
UPDATE categories SET color = '--cat-5', updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = 'cat-projets' AND color = '#8b5cf6';
