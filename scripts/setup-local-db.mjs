import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const npmCli = process.env.npm_execpath;

if (!npmCli) throw new Error('No se encontró la ruta de npm para preparar la base local.');

const run = (script) => {
  const result = spawnSync(process.execPath, [npmCli, 'run', script], {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

// Export before applying any schema changes. Fresh installs have no data to back up.
const backup = spawnSync(process.execPath, ['scripts/seed-local.mjs', '--backup-only'], { cwd: projectRoot, stdio: 'inherit' });
if (backup.status !== 0) throw new Error('No se pudo respaldar la base local; no se aplicaron cambios.');
run('db:migrate:local');
run('db:seed:local');
