import { FEATURED_ADJUSTMENT_FIELDS, normalizeFeaturedAdjustments, isValidFeaturedAdjustments } from './featured-config.js';
export const FEATURED_TEMPLATES = Object.freeze([
  { id: 'editorial-left', name: 'Editorial izquierda', position: 'left' },
  { id: 'editorial-right', name: 'Editorial derecha', position: 'right' },
  { id: 'centered', name: 'Centrado', position: 'center' },
]);
export const FEATURED_FIELDS = Object.freeze([
  { key: 'template', label: 'Plantilla', type: 'select', options: FEATURED_TEMPLATES.map(t => t.id), defaultValue: 'editorial-left' },
  { key: 'title1', label: 'Etiqueta del banner (vacío: etiqueta del producto)', type: 'text', defaultValue: '' },
  { key: 'title2', label: 'Título del banner (vacío: nombre del producto)', type: 'textarea', defaultValue: '' },
  { key: 'text', label: 'Descripción del banner (vacío: descripción corta)', type: 'textarea', defaultValue: '' },
  { key: 'imageUrl', label: 'Imagen del banner (vacío: imagen principal)', type: 'text', defaultValue: '' },
  { key: 'imageAlt', label: 'Texto alternativo del banner', type: 'text', defaultValue: '' },
  { key: 'linkLabel', label: 'Texto del botón', type: 'text', defaultValue: 'VER PRODUCTO →' },
  { key: 'overlayColor', label: 'Color del fondo', type: 'color', defaultValue: '#142fd3' },
  { key: 'textColor', label: 'Color del texto', type: 'color', defaultValue: '#ffffff' },
  { key: 'overlayOpacity', label: 'Intensidad del fondo (0–1)', type: 'number', min: 0, max: 1, step: 0.05, defaultValue: 0.9 },
  { key: 'showLine', label: 'Línea sobre el botón', type: 'boolean', defaultValue: true },
]);
export const fail = message => { throw new Error(message); };
export const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
export const textValue = (v, label, max = 10000) => {
  if (typeof v !== 'string' || v.length > max) fail(`${label}: texto inválido (máximo ${max} caracteres).`);
  return v.trim();
};
export const safeUrl = v => {
  const s = textValue(v ?? '', 'Imagen', 2000);
  if (s && !(/^\/(?!\/)/.test(s) || /^https?:\/\//i.test(s))) fail('Usa una ruta /resources/… o una URL http(s).');
  if (/[\u0000-\u0020\\]/.test(s)) fail('La URL contiene caracteres no permitidos.');
  return s;
};
export const integerValue = (v, label, min = 0, max = 2147483647) => {
  if (!Number.isSafeInteger(v) || v < min || v > max) fail(`${label}: ingresa un entero entre ${min} y ${max}.`);
  return v;
};
export const normalizeFeaturedConfig = (v = {}) => ({
  version: 1, ...Object.fromEntries(FEATURED_FIELDS.map(f => [f.key, v[f.key] ?? f.defaultValue])),
  title1Adj: normalizeFeaturedAdjustments(v.title1Adj ?? { horizontal: 'right', vertical: 'top', boxed: true, rounded: 'soft' }), title2Adj: normalizeFeaturedAdjustments(v.title2Adj),
});
export const validateFeaturedConfig = (v = {}) => {
  if (!object(v)) fail('Los ajustes deben ser un objeto.');
  const keys = ['version', 'title1Adj', 'title2Adj', ...FEATURED_FIELDS.map(f => f.key)];
  if (Object.keys(v).some(k => !keys.includes(k))) fail('Hay un ajuste visual desconocido.');
  if (v.version !== undefined && v.version !== 1) fail('Versión de ajustes no compatible.');
  for (const f of FEATURED_FIELDS) {
    const x = v[f.key]; if (x === undefined) continue;
    if (f.type === 'boolean' && typeof x !== 'boolean') fail(`${f.label}: valor inválido.`);
    if (f.type === 'select' && !f.options.includes(x)) fail(`${f.label}: opción inválida.`);
    if (f.type === 'number' && (typeof x !== 'number' || !Number.isFinite(x) || x < f.min || x > f.max)) fail(`${f.label}: fuera de rango.`);
    if (['text', 'textarea', 'color'].includes(f.type)) textValue(x, f.label, 4000);
    if (f.type === 'color' && !/^#[0-9a-f]{6}$/i.test(x)) fail('Color inválido.');
  }
  for (const key of ['title1Adj', 'title2Adj']) {
    if (v[key] !== undefined && (!isValidFeaturedAdjustments(v[key]) || Object.keys(v[key]).some(k => !FEATURED_ADJUSTMENT_FIELDS.some(f => f.key === k)))) fail('Ajuste de título inválido.');
  }
  safeUrl(v.imageUrl ?? ''); return normalizeFeaturedConfig(v);
};
export const validateContent = (v = {}) => {
  if (!object(v)) fail('Contenido inválido.');
  const known = ['gallery', 'edition', 'badges', 'options', 'story', 'includes', 'dimensionsMaterialsImage', 'dimensionsMaterialsAlt', 'details', 'specifications', 'relatedProducts', 'link'];
  if (Object.keys(v).some(k => !known.includes(k))) fail('Campo de contenido desconocido.');
  const list = (key, fn) => {
    if (v[key] === undefined) return;
    if (!Array.isArray(v[key]) || v[key].length > 100) fail(`${key}: máximo 100 elementos.`);
    v[key].forEach(fn);
  };
  list('gallery', r => { if (!object(r)) fail('Imagen inválida.'); safeUrl(r.src); textValue(r.alt ?? '', 'Texto alternativo'); });
  for (const key of ['details', 'specifications']) list(key, r => {
    if (!object(r)) fail('Especificación inválida.'); textValue(r.label, 'Nombre'); textValue(r.value, 'Valor');
  });
  for (const key of ['badges', 'relatedProducts']) list(key, r => textValue(r, key, 200));
  list('includes', r => {
    if (!object(r)) fail('Contenido incluido inválido.'); textValue(r.text, 'Texto');
    if (!/^[a-z0-9-]+$/.test(r.icon)) fail('Nombre de icono inválido.');
  });
  list('options', r => {
    if (!object(r) || !Array.isArray(r.values) || !r.values.length || r.values.length > 50) fail('Opciones inválidas.');
    textValue(r.label, 'Nombre de opción'); r.values.forEach(x => textValue(x, 'Opción', 200));
    integerValue(r.selected ?? 0, 'Opción seleccionada', 0, r.values.length - 1);
  });
  if (v.story != null) {
    if (!object(v.story)) fail('Historia inválida.');
    for (const k of ['eyebrow', 'title', 'text']) textValue(v.story[k] ?? '', 'Historia');
  }
  if (v.edition != null) {
    if (!object(v.edition)) fail('Edición inválida.');
    textValue(v.edition.label, 'Edición'); integerValue(v.edition.total, 'Total de edición', 1);
    integerValue(v.edition.current, 'Número de edición', 0, v.edition.total);
  }
  safeUrl(v.dimensionsMaterialsImage ?? ''); textValue(v.dimensionsMaterialsAlt ?? '', 'Texto alternativo');
  if (v.link != null && v.link !== '#contacto') safeUrl(v.link);
  return v;
};
export const DEFAULT_SETTINGS = Object.freeze({ tabMode: 'collections', autoplayMs: 6500, featuredEnabled: true });
export const validateSettings = v => {
  if (!object(v) || Object.keys(v).some(k => !Object.hasOwn(DEFAULT_SETTINGS, k))) fail('Configuración desconocida.');
  const out = { ...DEFAULT_SETTINGS, ...v };
  if (!['collections', 'categories'].includes(out.tabMode)) fail('Agrupación inválida.');
  integerValue(out.autoplayMs, 'Duración', 3000, 60000);
  if (typeof out.featuredEnabled !== 'boolean') fail('Estado de destacados inválido.');
  return out;
};

export const featuredFromProduct = product => {
  const c = normalizeFeaturedConfig(product.featuredConfig);
  return {
    id: product.id, databaseId: product.databaseId, productId: product.databaseId,
    Titulo1: c.title1 || product.label, Titulo2: c.title2 || product.title, Titulo1adj: c.title1Adj, Titulo2adj: c.title2Adj,
    Photo: c.imageUrl || product.photo, imageAlt: c.imageAlt || product.photoAlt,
    text: c.text || product.desc, LinkText: c.linkLabel || 'VER PRODUCTO →',
    LinkUrl: `/producto?id=${encodeURIComponent(product.id)}`, Line: c.showLine ? 'yes' : 'no',
    template: c.template, overlayColor: c.overlayColor, textColor: c.textColor, overlayOpacity: c.overlayOpacity,
  };
};
