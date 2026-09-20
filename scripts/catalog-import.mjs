import { normalizeFeaturedConfig, validateContent, validateFeaturedConfig } from '../src/shared/product-config.js';
const quote = v => v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replaceAll("'", "''")}'`;
const insert = (table, value) => `INSERT INTO ${table} (${Object.keys(value).join(',')}) VALUES (${Object.values(value).map(quote).join(',')});`;
export const slugify = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const jsonAsLegacy = (productData, toyData, tabData) => {
  const collections = tabData.tabs.filter(t => t.Collection !== '*').map((t, i) => ({ id: i + 1, name: t.Collection, slug: slugify(t.Collection), active: 1, sort_order: i }));
  const products = productData.products.map((p, i) => {
    const { gallery = [], options = [], includes = [], excludes = [], dimensionsMaterialsImage = '', dimensions = [], specifications = [], link = null } = p;
    const amount = Number(String(p.price).replace(/[^\d.]/g, ''));
    return { id: i + 1, legacy_id: p.id, slug: slugify(p.id), title: p.title, label: p.label, short_description: p.desc, long_description: p.longDescription,
      price_minor: Math.round(amount * 100), currency: 'MXN', stock: p.stock, primary_image_url: p.photo, primary_image_alt: gallery[0]?.alt ?? '',
      status: 'published', sort_order: i, content_json: JSON.stringify({ gallery, options, includes, excludes, dimensionsMaterialsImage, dimensions, specifications, link }), Collection: p.Collection };
  });
  const tagNames = [...new Set(productData.products.flatMap(p => p.tags ?? []))];
  const catalog_tags = tagNames.map((name, i) => ({ id: i + 1, name, slug: `tag-${Buffer.from(name).toString('hex').toLowerCase()}`, sort_order: i, active: 1 }));
  const product_tags = productData.products.flatMap((p, productIndex) => (p.tags ?? []).slice(0, 1).map(name => ({ product_id: productIndex + 1, tag_id: catalog_tags.find(t => t.name === name).id })));
  return { products, collections, catalog_tags, product_tags, categories: [{ id: 1, name: 'Figuras', slug: 'figuras', active: 1 }],
    product_categories: products.map(p => ({ product_id: p.id, category_id: 1 })),
    product_collections: products.map(p => ({ product_id: p.id, collection_id: collections.find(c => c.name === p.Collection)?.id })),
    catalog_tabs: tabData.tabs.map((t,i) => ({ target_type: t.Collection === '*' ? 'all' : 'collection', collection_id: collections.find(c => c.name === t.Collection)?.id, label: t.label, active: 1, sort_order: i })),
    featured_items: toyData.destacados.map((f,i) => ({ ...f, id: i+1, legacy_id: f.id, title1: f.Titulo1, title2: f.Titulo2, body: f.text, image_url: f.Photo, link_label: f.LinkText, link_url: f.LinkUrl, show_line: f.Line === 'yes' ? 1 : 0, title1Config: f.Titulo1adj, title2Config: f.Titulo2adj, active: 1, sort_order: i, target_type: 'collection' })),
    display_presets: [], featured_sections: [{ autoplay_ms: toyData.autoplayMs, active: 1 }], admin_audit_log: [] };
};
export const buildImport = source => {
  const now = new Date().toISOString();
  const life = row => ({ active: Number(Boolean(row.active ?? true) && !row.deleted_at), created_at: row.created_at ?? now, created_by: 'migration:legacy', updated_at: row.updated_at ?? now, updated_by: 'migration:legacy',
    deactivated_at: row.deleted_at ?? (row.active === 0 ? now : null), deactivated_by: row.deleted_at || row.active === 0 ? 'migration:legacy' : null, version: 1 });
  const sql = ['PRAGMA foreign_keys = ON;', 'BEGIN TRANSACTION;'];
  const taxonomy = (row, resource) => {
    const tab = source.catalog_tabs.find(t => t[resource === 'collections' ? 'collection_id' : 'category_id'] === row.id);
    return { id: row.id, name: row.name, slug: row.slug, description: row.description ?? '', image_url: row.image_url ?? '', image_alt: row.image_alt ?? '', tab_label: tab?.label ?? row.name, show_in_nav: Number(Boolean(tab?.active ?? true)), sort_order: tab?.sort_order ?? row.sort_order ?? 0, ...life(row) };
  };
  source.collections.forEach(c => sql.push(insert('catalog_collections', taxonomy(c, 'collections'))));
  source.categories.filter(c => !c.parent_id).forEach(c => sql.push(insert('catalog_categories', taxonomy(c, 'categories'))));
  source.categories.filter(c => c.parent_id).forEach(c => {
    if (!source.categories.some(p => p.id === c.parent_id && !p.parent_id)) throw new Error('Hay más de dos niveles de categorías. Requiere revisión antes de migrar.');
    sql.push(insert('catalog_subcategories', { ...taxonomy(c, 'categories'), category_id: c.parent_id }));
  });
  (source.catalog_tags ?? []).forEach(t => sql.push(insert('catalog_tags', { ...t, ...life(t) })));
  for (const p of source.products) {
    const cats = source.product_categories.filter(r => r.product_id === p.id), cols = source.product_collections.filter(r => r.product_id === p.id);
    if (cols.length !== 1 || cats.length < 1 || cats.length > 2) throw new Error(`Revisar clasificación de ${p.legacy_id}; no se descartan relaciones automáticamente.`);
    const categoryRecords = cats.map(r => source.categories.find(c => c.id === r.category_id));
    const sub = categoryRecords.find(c => c.parent_id), categoryId = sub?.parent_id ?? categoryRecords[0].id;
    if (categoryRecords.some(c => c.id !== categoryId && c !== sub)) throw new Error(`Categorías ambiguas para ${p.legacy_id}.`);
    const features = source.featured_items.filter(f => f.target_type === 'product' && f.product_id === p.id);
    if (features.length > 1) throw new Error(`Varios banners para ${p.legacy_id}; requiere selección explícita.`);
    const feature = features[0];
    const active = p.status === 'published' && !p.deleted_at;
    validateContent(JSON.parse(p.content_json));
    sql.push(insert('catalog_products', { id: p.id, code: p.legacy_id, slug: p.slug, title: p.title, label: p.label ?? '', short_description: p.short_description ?? '', long_description: p.long_description ?? '', price_minor: p.price_minor,
      currency: p.currency, stock: p.stock, primary_image_url: p.primary_image_url ?? '', primary_image_alt: p.primary_image_alt ?? '', content_json: p.content_json,
      collection_id: cols[0].collection_id, category_id: categoryId, subcategory_id: sub?.id ?? null, is_featured: Number(Boolean(feature?.active)),
      featured_order: feature?.sort_order ?? 0, featured_config_json: feature ? JSON.stringify(config(feature)) : '{}', sort_order: p.sort_order,
      ...life({ ...p, active: Number(active) }) }));
  }
  (source.product_tags ?? []).forEach(tag => sql.push(insert('product_tags', tag)));
  function config(f) {
    const preset = id => JSON.parse(source.display_presets.find(p => p.id === id)?.config_json ?? '{}');
    return validateFeaturedConfig(normalizeFeaturedConfig({ title1: f.title1, title2: f.title2, text: f.body ?? '', imageUrl: f.image_url, imageAlt: f.image_alt ?? '', linkLabel: f.link_label ?? 'VER PRODUCTO →', showLine: Boolean(f.show_line), title1Adj: f.title1Config ?? preset(f.title1_preset_id), title2Adj: f.title2Config ?? preset(f.title2_preset_id) }));
  }
  const pending = source.featured_items.filter(f => f.target_type !== 'product').map(f => ({ id: f.legacy_id, active: Boolean(f.active), sortOrder: f.sort_order, config: config(f), assignedProductId: null, original: f }));
  sql.push(insert('site_settings', { key: 'catalog', value_json: JSON.stringify({ tabMode: 'collections', autoplayMs: Math.max(3000, source.featured_sections[0]?.autoplay_ms ?? 6500), featuredEnabled: Boolean(source.featured_sections[0]?.active ?? true) }), ...life({}) }));
  sql.push(insert('site_settings', { key: 'legacy_featured', value_json: JSON.stringify(pending), ...life({}) }));
  for (const log of source.admin_audit_log ?? []) sql.push(insert('audit_log', { ...log, entity_type: `legacy:${log.entity_type}` }));
  // A single marker makes retries a no-op, protecting all subsequent admin edits.
  sql.push(insert('site_settings', { key: 'migration_v2', value_json: JSON.stringify({ importedAt: now, products: source.products.length, pendingFeatured: pending.length, archive: 'Original tables retained unchanged' }), ...life({}) }));
  sql.push(insert('audit_log', { actor_id: 'migration:legacy', entity_type: 'migration', entity_id: 'v2', action: 'import', after_json: JSON.stringify({ products: source.products.length, pendingFeatured: pending.length }), created_at: now }));
  sql.push('COMMIT;', 'PRAGMA optimize;');
  return sql.join('\n');
};
