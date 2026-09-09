import { DEFAULT_SETTINGS, normalizeFeaturedConfig, featuredFromProduct } from '../shared/product-config.js';
export const rows = result => result?.results ?? [];
export const camelRow = row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, x) => x.toUpperCase()), v]));
export const formatPrice = (minor, currency = 'MXN') => `${new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(minor / 100)} ${currency}`;
const visibility = `p.active = 1 AND c.active = 1 AND cat.active = 1 AND (p.subcategory_id IS NULL OR sub.active = 1)`;
export const listProducts = async (db, { includeInactive = false, identifier } = {}) => {
  const statement = db.prepare(`SELECT p.*, c.name AS collection_name, c.slug AS collection_slug,
    cat.name AS category_name, cat.slug AS category_slug, sub.name AS subcategory_name, sub.slug AS subcategory_slug,
    (${visibility}) AS visible FROM catalog_products p
    JOIN catalog_collections c ON c.id = p.collection_id JOIN catalog_categories cat ON cat.id = p.category_id
    LEFT JOIN catalog_subcategories sub ON sub.id = p.subcategory_id AND sub.category_id = p.category_id
    WHERE ${includeInactive ? '1=1' : visibility} ${identifier === undefined ? '' : 'AND (p.code = ? OR p.slug = ?)'} ORDER BY p.sort_order, p.id`);
  const result = await (identifier === undefined ? statement : statement.bind(identifier, identifier)).all();
  const now = Date.now();
  return rows(result).map(row => {
    const content = JSON.parse(row.content_json);
    const promotionActive = Boolean(row.is_promotion) && (!row.promotion_starts_at || Date.parse(row.promotion_starts_at) <= now) && (!row.promotion_ends_at || Date.parse(row.promotion_ends_at) > now);
    const effectivePriceMinor = promotionActive && row.promotion_price_minor !== null ? row.promotion_price_minor : row.price_minor;
    const product = {
      ...camelRow(row), ...content, content,
      id: row.code, databaseId: row.id, photo: row.primary_image_url, photoAlt: row.primary_image_alt,
      desc: row.short_description, Collection: row.collection_name,
      collections: [{ id: row.collection_id, name: row.collection_name, slug: row.collection_slug }],
      categories: [{ id: row.category_id, name: row.category_name, slug: row.category_slug }],
      active: Boolean(row.active), visible: Boolean(row.visible), isPromotion: Boolean(row.is_promotion),
      promotionActive, effectivePriceMinor, price: formatPrice(effectivePriceMinor, row.currency), regularPrice: formatPrice(row.price_minor, row.currency),
      badges: [...(content.badges ?? []), ...(promotionActive ? [row.promotion_label] : [])],
      isFeatured: Boolean(row.is_featured), featuredConfig: normalizeFeaturedConfig(JSON.parse(row.featured_config_json)),
    };
    if (!includeInactive) {
      for (const key of ['createdBy', 'updatedBy', 'deactivatedBy', 'deactivatedAt', 'version', 'contentJson', 'featuredConfigJson']) delete product[key];
    }
    return product;
  });
};
export const taxonomyTables = Object.freeze({ collections: 'catalog_collections', categories: 'catalog_categories', subcategories: 'catalog_subcategories' });
export const listTaxonomy = async (db, resource, includeInactive = false) => {
  const table = taxonomyTables[resource]; if (!table) throw new Error('Catálogo desconocido');
  const sub = resource === 'subcategories';
  const result = await db.prepare(`SELECT t.* ${sub ? ', c.name AS category_name, c.active AS parent_active' : ''} FROM ${table} t
    ${sub ? 'JOIN catalog_categories c ON c.id = t.category_id' : ''}
    ${includeInactive ? '' : `WHERE t.active = 1 ${sub ? 'AND c.active = 1' : ''}`} ORDER BY t.sort_order, t.name`).all();
  return rows(result).map(r => ({ ...camelRow(r), active: Boolean(r.active), showInNav: Boolean(r.show_in_nav) }));
};
export const getSettings = async db => {
  const row = await db.prepare("SELECT * FROM site_settings WHERE key = 'catalog'").first();
  return row ? { ...camelRow(row), active: Boolean(row.active), value: JSON.parse(row.value_json) } : { id: null, version: 0, active: true, value: { ...DEFAULT_SETTINGS } };
};
export const listCatalogTabs = async db => {
  const settings = await getSettings(db);
  const mode = settings.active ? settings.value.tabMode : DEFAULT_SETTINGS.tabMode;
  const items = await listTaxonomy(db, mode);
  const subcategories = mode === 'categories' ? await listTaxonomy(db, 'subcategories') : [];
  return [{ id: 'todos', label: 'TODOS', filterType: 'all', filterValue: '*', Collection: '*' },
    ...items.filter(x => x.showInNav).flatMap(x => [
      { id: x.slug, label: x.tabLabel || x.name, filterType: mode === 'collections' ? 'collection' : 'category', filterValue: x.slug, Collection: mode === 'collections' ? x.name : '*' },
      ...subcategories.filter(s => s.showInNav && s.categoryId === x.id).map(s => ({ id: `sub-${s.slug}`, label: s.tabLabel || `${x.name} / ${s.name}`, filterType: 'subcategory', filterValue: s.slug, Collection: '*' })),
    ])];
};
export const listFeaturedItems = async db => {
  const settings = await getSettings(db);
  if (!settings.active || !settings.value.featuredEnabled) return [];
  return (await listProducts(db)).filter(p => p.isFeatured).sort((a, b) => a.featuredOrder - b.featuredOrder || a.databaseId - b.databaseId).map(featuredFromProduct);
};
export const getPublicCatalog = async db => {
  const [products, tabs, settings] = await Promise.all([listProducts(db), listCatalogTabs(db), getSettings(db)]);
  return { products, tabs, destacados: settings.active && settings.value.featuredEnabled ? products.filter(p => p.isFeatured).sort((a,b) => a.featuredOrder - b.featuredOrder || a.databaseId - b.databaseId).map(featuredFromProduct) : [], autoplayMs: settings.value.autoplayMs };
};
export const getAdminSnapshot = async db => {
  const [products, categories, collections, subcategories, settings, pending, audit] = await Promise.all([
    listProducts(db, { includeInactive: true }), listTaxonomy(db, 'categories', true), listTaxonomy(db, 'collections', true), listTaxonomy(db, 'subcategories', true), getSettings(db),
    db.prepare("SELECT * FROM site_settings WHERE key = 'legacy_featured'").first(), db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 100').all(),
  ]);
  return { products, categories, collections, subcategories, settings, pendingFeatured: pending ? JSON.parse(pending.value_json) : [], pendingVersion: pending?.version ?? 0, audit: rows(audit).map(camelRow) };
};
