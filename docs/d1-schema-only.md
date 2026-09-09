# Publicar solamente el esquema en D1

El proyecto tiene tres migraciones acumulativas en `drizzle/`:

- `0000_grey_redwing.sql`: esquema inicial.
- `0001_dear_sue_storm.sql`: modelo simplificado y tablas activas.
- `0002_clean_longshot.sql`: elimina las tablas antiguas respetando claves foráneas.

Las migraciones no contienen carga de productos. Al aplicarlas en una base remota
nueva, el resultado es una base vacía con seis tablas finales:
`catalog_products`, `catalog_collections`, `catalog_categories`,
`catalog_subcategories`, `site_settings` y `audit_log`.

## Flujo

Comprobar autenticación:

```powershell
npx wrangler whoami
```

Revisar migraciones pendientes:

```powershell
npx wrangler d1 migrations list DB --remote
```

Aplicar solo el esquema:

```powershell
npm run db:migrate:remote
```

Equivale a:

```powershell
npx wrangler d1 migrations apply DB --remote
```

No ejecutar `npm run db:seed:local` ni `npm run db:setup:local` contra la base
remota. Esos comandos son únicamente para desarrollo local.

## Verificar que quedó vacía

```powershell
npx wrangler d1 execute DB --remote --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;"
npx wrangler d1 execute DB --remote --command "SELECT COUNT(*) AS total FROM catalog_products;"
```

El segundo comando debe devolver `0`. La importación de productos será un paso
separado y explícito.

La configuración ya usa el binding `DB` y la base `sepia-catalog` en
`wrangler.jsonc`. Wrangler/Cloudflare resolverá el ID físico y la autorización.
