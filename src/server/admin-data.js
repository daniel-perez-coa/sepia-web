import { taxonomyTables, rows } from './catalog-data.js';
import { fail, integerValue, textValue, safeUrl, validateContent, validateFeaturedConfig, validateSettings, normalizeFeaturedConfig } from '../shared/product-config.js';

const tables = { ...taxonomyTables, tags: 'catalog_tags', products: 'catalog_products', settings: 'site_settings', 'delivery-points': 'delivery_points' };
const bool = (v, label) => { if (typeof v !== 'boolean') fail(`${label}: estado inválido.`); return Number(v); };
const slug = v => { const s = textValue(v, 'Slug', 160); if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) fail('Slug: usa minúsculas, números y guiones.'); return s; };
const date = v => {
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !Number.isFinite(Date.parse(v))) fail('Fecha inválida: incluye zona horaria.');
  return new Date(v).toISOString();
};
const required = (v, label, max = 200) => { const t = textValue(v, label, max); if (!t) fail(`${label} es obligatorio.`); return t; };
const coordinate = (v, label, min, max) => {
  const text = required(String(v ?? ''), label, 30);
  if (!/^-?\d{1,3}(?:\.\d+)?$/.test(text)) fail(`${label}: usa un número decimal válido.`);
  const number = Number(text);
  if (!Number.isFinite(number) || number < min || number > max) fail(`${label}: valor fuera de rango.`);
  return String(number);
};
const optionalStock = v => { if (v === null || v === undefined || v === '') return null; return integerValue(v, 'Existencias'); };
export const getRecord = async (db, resource, id) => {
  if (!Object.hasOwn(tables, resource)) fail('Recurso inválido.');
  const row = await db.prepare(`SELECT * FROM ${tables[resource]} WHERE id = ?`).bind(id).first();
  if (!row) throw new Response('Registro no encontrado.', { status: 404 });
  return row;
};
const checkVersion = (before, v) => {
  if (before && v !== before.version) throw new Response('El registro cambió. Recarga antes de guardar.', { status: 409 });
};

// Each guarded write is immediately followed by its audit INSERT in the same D1 batch.
// A concurrent version/relationship change makes changes() zero; NOT NULL then aborts
// the entire transaction, including any preceding writes (e.g. a banner association).
export const writeStatements = (db, resource, before, fields, actor, action = before ? 'update' : 'create', guard = '1=1', guardArgs = []) => {
  const table = tables[resource];
  const now = new Date().toISOString();
  const active = fields.active ?? before?.active ?? 1;
  const data = { ...fields, active, updated_at: now, updated_by: actor.id,
    deactivated_at: active ? null : before?.deactivated_at ?? now,
    deactivated_by: active ? null : before?.deactivated_by ?? actor.id,
    version: (before?.version ?? 0) + 1,
    ...(!before ? { created_at: now, created_by: actor.id } : {}),
  };
  const columns = Object.keys(data);
  const write = before
    ? db.prepare(`UPDATE ${table} SET ${columns.map(k => `${k} = ?`).join(',')} WHERE id = ? AND version = ? AND (${guard}) RETURNING *`).bind(...Object.values(data), before.id, before.version, ...guardArgs)
    : db.prepare(`INSERT INTO ${table} (${columns.join(',')}) SELECT ${columns.map(() => '?').join(',')} WHERE ${guard} RETURNING *`).bind(...Object.values(data), ...guardArgs);
  const afterKeys = [...new Set(['id', ...Object.keys(before ?? {}), ...columns])];
  const jsonSql = `SELECT json_object(${afterKeys.map(k => `'${k}', ${k}`).join(',')}) FROM ${table} WHERE id = ${before ? '?' : 'last_insert_rowid()'}`;
  const audit = db.prepare(`INSERT INTO audit_log (actor_id, actor_email, entity_type, entity_id, action, before_json, after_json, created_at)
    VALUES (?, ?, ?, CASE WHEN changes() = 1 THEN CAST(${before ? '?' : 'last_insert_rowid()'} AS TEXT) ELSE NULL END, ?, ?, (${jsonSql}), ?)`)
    .bind(actor.id, actor.email ?? null, resource, ...(before ? [before.id] : []), action, before ? JSON.stringify(before) : null, ...(before ? [before.id] : []), now);
  return [write, audit];
};
const prepareSave = async (db, resource, payload, actor, id) => {
  const before = id == null ? null : await getRecord(db, resource, id);
  checkVersion(before, payload.version);
  const guards = [], guardArgs = [];
  const relation = async (table, value, previous) => {
    integerValue(value, 'Catálogo', 1);
    const row = await db.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(value).first();
    if (!row || (!row.active && previous !== value)) fail('Selecciona un catálogo existente y activo.');
    // Existing inactive associations may be retained without making the product public.
    if (previous !== value) { guards.push(`EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND active = 1)`); guardArgs.push(value); }
    return row;
  };
  let fields;
  let productTagIds = null;
  if (resource === 'products') {
    const code = required(payload.code, 'Código', 100);
    if (!/^[A-Za-z0-9_-]+$/.test(code)) fail('Código inválido.');
    if (before && (before.code !== code || before.slug !== payload.slug)) fail('El código y el slug son estables para conservar los enlaces.');
    await relation(tables.collections, payload.collectionId, before?.collection_id);
    await relation(tables.categories, payload.categoryId, before?.category_id);
    const subId = payload.subcategoryId ?? null;
    if (subId !== null) {
      const sub = await relation(tables.subcategories, subId, before?.subcategory_id);
      if (sub.category_id !== payload.categoryId) fail('La subcategoría no pertenece a la categoría seleccionada.');
    }
    if (payload.tagId !== null && payload.tagId !== undefined && payload.tagId !== '') integerValue(payload.tagId, 'Etiqueta', 1);
    productTagIds = payload.tagId === null || payload.tagId === undefined || payload.tagId === '' ? [] : [Number(payload.tagId)];
    const existingTagIds = before
      ? rows(await db.prepare('SELECT tag_id FROM product_tags WHERE product_id = ?').bind(before.id).all()).map(row => row.tag_id)
      : [];
    for (const tagId of productTagIds) {
      const tag = await db.prepare('SELECT * FROM catalog_tags WHERE id = ?').bind(tagId).first();
      if (!tag || (!tag.active && !existingTagIds.includes(tagId))) fail('Selecciona únicamente etiquetas existentes y activas.');
    }
    const price = integerValue(payload.priceMinor, 'Precio en centavos');
    const promo = payload.promotionPriceMinor ?? null;
    if (promo !== null) { integerValue(promo, 'Precio promocional'); if (promo >= price) fail('El precio promocional debe ser menor al normal.'); }
    const start = date(payload.promotionStartsAt ?? null), end = date(payload.promotionEndsAt ?? null);
    if (start && end && start >= end) fail('El fin debe ser posterior al inicio.');
    if (payload.currency !== 'MXN') fail('Por ahora el catálogo utiliza MXN.');
    const content = validateContent(payload.content ?? {});
    if (payload.active) {
      required(payload.shortDescription ?? '', 'Descripción corta', 10000);
      required(payload.longDescription ?? '', 'Descripción completa', 10000);
      if (!safeUrl(payload.primaryImageUrl) || !content.specifications?.length) fail('Un producto activo necesita imagen principal y al menos una especificación.');
    }
    const featuredConfig = validateFeaturedConfig(payload.featuredConfig ?? {});
    if (payload.isFeatured && featuredConfig.title1) {
      const featuredTag = await db.prepare('SELECT id FROM catalog_tags WHERE name = ? AND active = 1').bind(featuredConfig.title1).first();
      if (!featuredTag) fail('Selecciona una etiqueta activa del catálogo para el banner destacado.');
    }
    fields = { code, slug: slug(payload.slug), title: required(payload.title, 'Nombre'), label: textValue(payload.label ?? '', 'Etiqueta', 200),
      short_description: textValue(payload.shortDescription ?? '', 'Descripción corta'), long_description: textValue(payload.longDescription ?? '', 'Descripción'),
      price_minor: price, currency: 'MXN', stock: optionalStock(payload.stock),
      primary_image_url: safeUrl(payload.primaryImageUrl), primary_image_alt: textValue(payload.primaryImageAlt ?? '', 'Texto alternativo'),
      content_json: JSON.stringify(content), collection_id: payload.collectionId, category_id: payload.categoryId, subcategory_id: subId,
      is_promotion: bool(payload.isPromotion ?? false, 'Promoción'), promotion_label: required(payload.promotionLabel ?? 'PROMOCIÓN', 'Etiqueta promocional'),
      promotion_price_minor: promo, promotion_starts_at: start, promotion_ends_at: end,
      is_featured: bool(payload.isFeatured ?? false, 'Destacado'), featured_order: integerValue(payload.featuredOrder ?? 0, 'Orden destacado'),
      featured_config_json: JSON.stringify(featuredConfig),
      sort_order: integerValue(payload.sortOrder ?? 0, 'Orden'), active: bool(payload.active, 'Activo') };
  } else if (resource === 'tags') {
    fields = { name: required(payload.name, 'Nombre'), slug: slug(payload.slug), sort_order: integerValue(payload.sortOrder ?? 0, 'Orden'), active: bool(payload.active, 'Activo') };
  } else if (Object.hasOwn(taxonomyTables, resource)) {
    fields = { name: required(payload.name, 'Nombre'), slug: slug(payload.slug), description: textValue(payload.description ?? '', 'Descripción'),
      image_url: safeUrl(payload.imageUrl), image_alt: textValue(payload.imageAlt ?? '', 'Texto alternativo'),
      tab_label: textValue(payload.tabLabel ?? '', 'Etiqueta de navegación', 200), show_in_nav: bool(payload.showInNav ?? true, 'Navegación'),
      sort_order: integerValue(payload.sortOrder ?? 0, 'Orden'), active: bool(payload.active, 'Activo') };
    if (resource === 'subcategories') { await relation(tables.categories, payload.categoryId, before?.category_id); fields.category_id = payload.categoryId; }
  } else if (resource === 'settings') {
    if (before && before.key !== 'catalog') fail('Configuración protegida.');
    fields = { ...(before ? {} : { key: 'catalog' }), value_json: JSON.stringify(validateSettings(payload.value)), active: bool(payload.active, 'Activo') };
  } else if (resource === 'delivery-points') {
    const nextSortOrder = payload.sortOrder ?? before?.sort_order ?? (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM delivery_points').first()).next_order;
    fields = {
      name: required(payload.name, 'Lugar'),
      address: textValue(payload.address ?? '', 'Dirección', 500),
      instructions: textValue(payload.instructions ?? '', 'Instrucciones de entrega', 1000),
      schedule: required(payload.schedule, 'Horario', 500),
      latitude: coordinate(payload.latitude, 'Latitud', -90, 90),
      longitude: coordinate(payload.longitude, 'Longitud', -180, 180),
      sort_order: integerValue(nextSortOrder, 'Orden'),
      active: bool(payload.active, 'Activo'),
    };
  } else fail('Operación no permitida.');
  const action = before && fields.active !== before.active ? (fields.active ? 'reactivate' : 'deactivate') : before ? 'update' : 'create';
  const statements = writeStatements(db, resource, before, fields, actor, action, guards.join(' AND ') || '1=1', guardArgs);
  if (resource === 'products') {
    statements.push(db.prepare('DELETE FROM product_tags WHERE product_id = (SELECT id FROM catalog_products WHERE code = ?)').bind(fields.code));
    productTagIds.forEach(tagId => statements.push(db.prepare(`INSERT INTO product_tags (product_id, tag_id)
      SELECT p.id, t.id FROM catalog_products p JOIN catalog_tags t ON t.id = ? WHERE p.code = ?`).bind(tagId, fields.code)));
  }
  return statements;
};
export const saveRecord = async (db, resource, payload, actor, id = null) => {
  const result = await db.batch(await prepareSave(db, resource, payload, actor, id));
  return { id: result[0].results[0].id };
};
export const setRecordActive = async (db, resource, id, payload, actor, active) => {
  const before = await getRecord(db, resource, id); checkVersion(before, payload.version);
  if (resource === 'settings' && before.key !== 'catalog') fail('Configuración protegida.');
  if (active && resource === 'products') {
    const content = JSON.parse(before.content_json);
    const missing = [];
    if (!before.short_description) missing.push('descripción corta');
    if (!before.long_description) missing.push('descripción completa');
    if (!before.primary_image_url) missing.push('imagen principal');
    if (!content.specifications?.length) missing.push('al menos una especificación');
    if (missing.length) fail(`Para publicar el producto completa: ${missing.join(', ')}.`);
  }
  await db.batch(writeStatements(db, resource, before, { active: Number(active) }, actor, active ? 'reactivate' : 'deactivate'));
  return { id };
};
export const assignLegacyFeatured = async (db, payload, actor) => {
  const setting = await db.prepare("SELECT * FROM site_settings WHERE key = 'legacy_featured'").first();
  if (!setting) fail('No hay banners pendientes.');
  checkVersion(setting, payload.pendingVersion);
  const drafts = JSON.parse(setting.value_json);
  const draft = drafts.find(x => x.id === payload.legacyId && !x.assignedProductId);
  if (!draft) fail('El banner ya fue asociado o no existe.');
  const product = await getRecord(db, 'products', integerValue(payload.productId, 'Producto', 1));
  checkVersion(product, payload.productVersion);
  if (product.is_featured || JSON.stringify(normalizeFeaturedConfig(JSON.parse(product.featured_config_json))) !== JSON.stringify(normalizeFeaturedConfig())) fail('El producto ya tiene una presentación; selecciona otro para no sobrescribirla.');
  draft.assignedProductId = product.id; draft.assignedAt = new Date().toISOString();
  await db.batch([
    ...writeStatements(db, 'products', product, { is_featured: Number(draft.active), featured_order: draft.sortOrder,
      featured_config_json: JSON.stringify(validateFeaturedConfig(draft.config)) }, actor, 'associate_featured'),
    ...writeStatements(db, 'settings', setting, { value_json: JSON.stringify(drafts) }, actor, 'associate_featured'),
  ]);
  return { id: product.id };
};
