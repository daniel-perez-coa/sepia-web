import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildImport, jsonAsLegacy } from './catalog-import.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
const run = args => {
  const r = spawnSync(process.execPath, [resolve(root, 'node_modules/wrangler/bin/wrangler.js'), 'd1', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (r.error || r.status !== 0) throw new Error(r.error?.message ?? r.stderr ?? r.stdout);
  return r.stdout;
};
const read = sql => JSON.parse(run(['execute', 'DB', '--local', '--command', sql, '--json']))[0].results;
const backups = resolve(root, '.local-backups'); mkdirSync(backups, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = resolve(backups, `catalog-${stamp}.sql`);
run(['export', 'DB', '--local', '--output', backup]);
console.log(`Respaldo local: ${backup}`);
if (!process.argv.includes('--backup-only')) {
  if (read("SELECT id FROM site_settings WHERE key = 'migration_v2'").length) {
    console.log('La importación ya se realizó; no se sobrescribió ningún registro.');
  } else {
    const source = {};
    const oldTables = read("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products'").length > 0;
    for (const table of oldTables ? ['products', 'collections', 'categories', 'product_categories', 'product_collections', 'catalog_tabs', 'featured_items', 'display_presets', 'featured_sections', 'admin_audit_log'] : []) source[table] = read(`SELECT * FROM ${table}`);
    const readJson = p => JSON.parse(readFileSync(resolve(root, p), 'utf8'));
    const data = source.products.length ? source : jsonAsLegacy(readJson('public/data/c_products.json'), readJson('public/data/c_toys.json'), readJson('public/data/c_tabs.json'));
    const seedPath = resolve(backups, `import-${stamp}.sql`);
    writeFileSync(seedPath, buildImport(data));
    run(['execute', 'DB', '--local', '--file', seedPath]);
    console.log(`Importados ${data.products.length} productos; tablas originales y JSON intactos.`);
  }
}
