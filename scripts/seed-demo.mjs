import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetPath = resolve(__dirname, '../src/lib/demo-seed-state.json');

const isReset = process.argv.includes('--reset');

const payload = {
  seeded: !isReset,
  referenceDate: '2026-11-02',
  userName: isReset ? '' : 'Selasi',
};

writeFileSync(targetPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');

if (isReset) {
  console.log('[seed:demo] Données de démo désactivées (état premier lancement).');
} else {
  console.log('[seed:demo] Données de démo des maquettes activées (Selasi · 2026-11-02).');
}
