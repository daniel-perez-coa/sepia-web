import { getPublicCatalog, listProducts, listTaxonomy, listTags, listFeaturedItems, listDeliveryPoints, getSettings, getAdminSnapshot } from './catalog-data.js';
import { saveRecord, setRecordActive, assignLegacyFeatured } from './admin-data.js';
import { FEATURED_FIELDS, FEATURED_TEMPLATES, object } from '../shared/product-config.js';
import { FEATURED_ADJUSTMENT_FIELDS } from '../shared/featured-config.js';
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const lookupPlaces = async (query, explicit) => {
  const photonUrl = new URL('https://photon.komoot.io/api/');
  photonUrl.search = new URLSearchParams({ q: query, limit: '5', countrycode: 'MX', lat: '19.0414', lon: '-98.2063', zoom: '10' }).toString();
  try {
    const response = await fetch(photonUrl, { signal: AbortSignal.timeout(8000), cf: { cacheEverything: true, cacheTtl: 300 } });
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data.features) && (data.features.length || !explicit)) return data.features;
    }
  } catch { /* An explicit search can fall back to Nominatim. */ }
  if (!explicit) throw new Response('No pudimos cargar sugerencias. Usa Buscar o selecciona el punto en el mapa.', { status: 502 });
  const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
  nominatimUrl.search = new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', countrycodes: 'mx', 'accept-language': 'es' }).toString();
  try {
    const response = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'SepiaChromaStreet/1.0 (address lookup for admin delivery points)' },
      signal: AbortSignal.timeout(8000),
      cf: { cacheEverything: true, cacheTtl: 300 },
    });
    if (!response.ok) throw new Error();
    const places = await response.json();
    return places.map(place => ({
      properties: { name: place.display_name },
      geometry: { coordinates: [Number(place.lon), Number(place.lat)] },
    }));
  } catch { throw new Response('No pudimos buscar direcciones. Selecciona el punto directamente en el mapa.', { status: 502 }); }
};
const decodeAccessPayload = token => {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - part.length % 4) % 4);
    return JSON.parse(atob(base64));
  } catch { return null; }
};
export const getAdminActor = (request, env) => {
  if (env.LOCAL_DEV_AUTH === 'true') return { id: 'local_seedy', email: 'local@localhost' };
  const legacyId = request.headers.get('oai-authenticated-user-id');
  const accessPayload = decodeAccessPayload(request.headers.get('Cf-Access-Jwt-Assertion') ?? '');
  const id = legacyId ?? accessPayload?.sub;
  const email = request.headers.get('oai-authenticated-user-email')
    ?? accessPayload?.email
    ?? accessPayload?.preferred_username
    ?? request.headers.get('Cf-Access-Authenticated-User-Email');
  if (!id || !accessPayload && !legacyId) throw new Response('Autenticación requerida por Cloudflare Access.', { status: 401 });
  const allowedIds = String(env.ADMIN_USER_IDS ?? '').split(',').map(x => x.trim()).filter(Boolean);
  const allowedEmails = String(env.ADMIN_USER_EMAILS ?? '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  if (!(allowedIds.includes(id) || email && allowedEmails.includes(String(email).toLowerCase()))) throw new Response('Tu cuenta no tiene permiso de administración.', { status: 403 });
  return { id, email };
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
      if (path === '/api/admin/place-suggestions' && request.method === 'GET') {
        const query = url.searchParams.get('q')?.trim() ?? '';
        if (query.length < 3 || query.length > 120) return json({ error: 'Escribe entre 3 y 120 caracteres para buscar.' }, 400);
        return json({ features: await lookupPlaces(query, url.searchParams.get('explicit') === '1') });
      }
      if (!['POST', 'PUT', 'DELETE'].includes(request.method)) return json({ error: 'Operación no permitida.' }, 405);
      const origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return json({ error: 'Origen no permitido.' }, 403);
      const body = await payloadFor(request);
      if (path === '/api/admin/assign-featured' && request.method === 'POST') return json({ ok: true, ...await assignLegacyFeatured(env.DB, body, actor) });
      const match = path.match(/^\/api\/admin\/(products|collections|categories|subcategories|tags|settings|delivery-points)(?:\/(\d+))?(?:\/(reactivate|deactivate))?$/);
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
    if (path === '/api/tags') return json({ tags: await listTags(env.DB) });
    if (path === '/api/featured') return json({ featured: await listFeaturedItems(env.DB) });
    if (path === '/api/delivery') {
      const [deliveryPoints, settings] = await Promise.all([listDeliveryPoints(env.DB), getSettings(env.DB)]);
      return json({ deliveryPoints, whatsappPhone: settings.value.whatsappPhone });
    }
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
