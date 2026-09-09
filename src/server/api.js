import { getPublicCatalog, listProducts, listTaxonomy, listFeaturedItems, getAdminSnapshot } from './catalog-data.js';
import { saveRecord, setRecordActive, assignLegacyFeatured } from './admin-data.js';
import { FEATURED_FIELDS, FEATURED_TEMPLATES, object } from '../shared/product-config.js';
import { FEATURED_ADJUSTMENT_FIELDS } from '../shared/featured-config.js';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const getAdminActor = (request, env) => {
  const id = request.headers.get('oai-authenticated-user-id');
  if (!id) throw new Response('Inicia sesión para administrar el catálogo.', { status: 401 });
  const allowed = String(env.ADMIN_USER_IDS ?? '').split(',').map(x => x.trim()).filter(Boolean);
  if (!allowed.includes(id)) throw new Response('Tu cuenta no tiene permiso de administración.', { status: 403 });
  return { id, email: request.headers.get('oai-authenticated-user-email') };
};
const payloadFor = async request => {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Response('Se requiere JSON.', { status: 415 });
  const reader = request.body?.getReader(); if (!reader) throw new Response('Falta el cuerpo JSON.', { status: 400 });
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > 524288) { await reader.cancel(); throw new Response('Solicitud demasiado grande.', { status: 413 }); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { const data = JSON.parse(new TextDecoder().decode(bytes)); if (!object(data)) throw new Error(); return data; }
  catch { throw new Response('JSON inválido.', { status: 400 }); }
};
export const handleApiRequest = async (request, env) => {
  const url = new URL(request.url), path = url.pathname;
  if (!path.startsWith('/api/')) return null;
  if (!env.DB) return json({ error: 'La base de datos no está configurada.' }, 503);
  try {
    if (path.startsWith('/api/admin/')) {
      const actor = getAdminActor(request, env);
      if (path === '/api/admin/bootstrap' && request.method === 'GET') return json({ actor, ...await getAdminSnapshot(env.DB), featuredFields: FEATURED_FIELDS, featuredTemplates: FEATURED_TEMPLATES, featuredAdjustmentFields: FEATURED_ADJUSTMENT_FIELDS });
      if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return json({ error: 'Operación no permitida.' }, 405);
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Origen no permitido.' }, 403);
      const body = await payloadFor(request);
      if (path === '/api/admin/assign-featured' && request.method === 'POST') return json({ ok: true, ...await assignLegacyFeatured(env.DB, body, actor) });
      const match = path.match(/^\/api\/admin\/(products|collections|categories|subcategories|settings)(?:\/(\d+))?(?:\/(reactivate|deactivate))?$/);
      if (!match) return json({ error: 'Ruta no encontrada.' }, 404);
      const [, resource, idText, action] = match, id = idText ? Number(idText) : null;
      if (id && action && request.method === 'POST') return json({ ok: true, ...await setRecordActive(env.DB, resource, id, body, actor, action === 'reactivate') });
      if (id && !action && request.method === 'DELETE') return json({ ok: true, ...await setRecordActive(env.DB, resource, id, body, actor, false) });
      if ((!id && request.method === 'POST' || id && request.method === 'PUT') && !action) return json({ ok: true, ...await saveRecord(env.DB, resource, body, actor, id) });
      return json({ error: 'Operación no permitida.' }, 405);
    }
    if (request.method !== 'GET') return json({ error: 'Operación no permitida.' }, 405);
    if (path === '/api/catalog') return json(await getPublicCatalog(env.DB));
    if (path === '/api/products') return json({ products: await listProducts(env.DB) });
    if (path.startsWith('/api/products/')) {
      const [product] = await listProducts(env.DB, { identifier: decodeURIComponent(path.slice(14)) });
      return product ? json({ product }) : json({ error: 'Producto no encontrado.' }, 404);
    }
    for (const resource of ['categories', 'collections', 'subcategories']) if (path === `/api/${resource}`) return json({ [resource]: await listTaxonomy(env.DB, resource) });
    if (path === '/api/featured') return json({ featured: await listFeaturedItems(env.DB) });
    if (path === '/api/config/featured-adjustments') return json({ version: 1, fields: FEATURED_ADJUSTMENT_FIELDS, templates: FEATURED_TEMPLATES, featuredFields: FEATURED_FIELDS });
    return json({ error: 'Ruta no encontrada.' }, 404);
  } catch (error) {
    if (error instanceof Response) return json({ error: await error.text() }, error.status);
    const message = String(error?.message ?? 'Error interno');
    if (/constraint|unique|foreign key/i.test(message)) return json({ error: 'Conflicto de datos o edición simultánea. Recarga y revisa la clasificación.' }, 409);
    if (/D1_|SQLITE|database|no such/i.test(message)) { console.error(error); return json({ error: 'No se pudo completar la operación en la base de datos.' }, 500); }
    return json({ error: message }, 400);
  }
};
