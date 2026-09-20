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
  { key: 'titleSize', label: 'Tamaño del título en px (0: automático)', type: 'number', min: 0, max: 96, step: 1, defaultValue: 0 },
  { key: 'text', label: 'Descripción del banner (vacío: descripción corta)', type: 'textarea', defaultValue: '' },
  { key: 'descriptionSize', label: 'Tamaño de la descripción en px (0: automático)', type: 'number', min: 0, max: 40, step: 1, defaultValue: 0 },
  { key: 'imageUrl', label: 'Imagen del banner (vacío: imagen principal)', type: 'text', defaultValue: '' },
  { key: 'imageAlt', label: 'Texto alternativo del banner', type: 'text', defaultValue: '' },
  { key: 'linkLabel', label: 'Texto del botón', type: 'text', defaultValue: 'VER PRODUCTO →' },
  { key: 'linkColor', label: 'Color del texto del botón', type: 'color', defaultValue: '#ffffff' },
  { key: 'lineColor', label: 'Color de la línea sobre el botón', type: 'color', defaultValue: '#ffffff' },
  { key: 'labelColor', label: 'Color de la etiqueta del banner', type: 'color', defaultValue: '#ffffff' },
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
export const normalizeFeaturedConfig = (v = {}) => {
  const normalized = {
    version: 1, ...Object.fromEntries(FEATURED_FIELDS.map(f => [f.key, v[f.key] ?? f.defaultValue])),
    title1Adj: normalizeFeaturedAdjustments(v.title1Adj ?? { horizontal: 'right', vertical: 'top', boxed: true, rounded: 'soft' }), title2Adj: normalizeFeaturedAdjustments(v.title2Adj),
  };
  for (const key of ['linkColor', 'lineColor', 'labelColor']) if (v[key] === undefined) normalized[key] = normalized.textColor;
  return normalized;
};
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
    const legacyKeys = ['textAlign', 'justify'];
    if (v[key] !== undefined && (!isValidFeaturedAdjustments(v[key]) || Object.keys(v[key]).some(k => !FEATURED_ADJUSTMENT_FIELDS.some(f => f.key === k) && !legacyKeys.includes(k)))) fail('Ajuste de título inválido.');
  }
  safeUrl(v.imageUrl ?? ''); return normalizeFeaturedConfig(v);
};
export const validateContent = (v = {}) => {
  if (!object(v)) fail('Contenido inválido.');
  const known = ['gallery', 'options', 'variantLabel', 'variants', 'includes', 'excludes', 'dimensionsMaterialsImage', 'dimensions', 'specifications', 'link'];
  if (Object.keys(v).some(k => !known.includes(k))) fail('Campo de contenido desconocido.');
  const list = (key, fn) => {
    if (v[key] === undefined) return;
    if (!Array.isArray(v[key]) || v[key].length > 100) fail(`${key}: máximo 100 elementos.`);
    v[key].forEach((item, index) => fn(item, `${key}[${index}]`));
  };
  const position = path => Number(path.match(/\[(\d+)\]/)?.[1] ?? 0) + 1;
  list('gallery', (r, path) => { if (!object(r)) fail(`En Galería, la imagen ${position(path)} no es válida.`); safeUrl(r.src); textValue(r.alt ?? '', `Galería, imagen ${position(path)}: texto alternativo`); });
  list('specifications', (r, path) => {
    if (!object(r)) fail(`En Especificaciones, el registro ${position(path)} no es válido.`); textValue(r.label, `En Especificaciones, registro ${position(path)}: nombre`); textValue(r.value, `En Especificaciones, registro ${position(path)}: valor`);
  });
  list('includes', (r, path) => {
    if (!object(r)) fail(`En “Qué incluye”, el elemento ${position(path)} no es válido.`); textValue(r.text, `En “Qué incluye”, elemento ${position(path)}: texto`);
    if (!/^[a-z0-9-]+$/.test(r.icon)) fail(`En “Qué incluye”, elemento ${position(path)}: usa un nombre de icono válido, por ejemplo “box” o “circle”.`);
  });
  list('excludes', (r, path) => {
    if (!object(r)) fail(`En “Qué no incluye”, el elemento ${position(path)} no es válido.`); textValue(r.text, `En “Qué no incluye”, elemento ${position(path)}: texto`);
    if (!/^[a-z0-9-]+$/.test(r.icon)) fail(`En “Qué no incluye”, elemento ${position(path)}: usa un nombre de icono válido.`);
  });
  list('dimensions', (r, path) => {
    if (!object(r)) fail(`En Dimensiones, el registro ${position(path)} no es válido.`);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.icon)) fail(`En Dimensiones, registro ${position(path)}: usa un nombre de icono válido.`);
    textValue(r.title, `En Dimensiones, registro ${position(path)}: título`, 200);
    textValue(r.value, `En Dimensiones, registro ${position(path)}: valor`, 200);
  });
  list('options', (r, path) => {
    const option = `En “Opciones del producto”, opción ${position(path)}`;
    if (!object(r)) fail(`${option}: este bloque no es válido.`);
    if (!Array.isArray(r.values)) fail(`${option}: los valores deben ser una lista.`);
    if (!r.values.length) fail(`${option}: escribe al menos un valor en el campo “Un valor por línea”, o elimina esta opción.`);
    if (r.values.length > 50) fail(`${option}: agrega como máximo 50 valores.`);
    textValue(r.label, `${option}: nombre de la opción`); r.values.forEach((x, i) => textValue(x, `${option}: valor ${i + 1}`, 200));
    integerValue(r.selected ?? 0, `${option}: selección inicial`, 0, r.values.length - 1);
  });
  if (v.variantLabel !== undefined) textValue(v.variantLabel, 'Nombre de las variantes', 100);
  list('variants', (r, path) => {
    const variant = `En Variantes, registro ${position(path)}`;
    if (!object(r)) fail(`${variant}: este registro no es válido.`);
    textValue(r.value, `${variant}: nombre`, 200);
    integerValue(r.priceMinor, `${variant}: precio`);
    if (r.stock !== null && r.stock !== undefined) integerValue(r.stock, `${variant}: existencias`);
    if (typeof r.isPromotion !== 'boolean') fail(`${variant}: el estado de promoción no es válido.`);
    textValue(r.promotionLabel ?? 'PROMOCIÓN', `${variant}: etiqueta promocional`, 100);
    if (r.promotionPriceMinor !== null && r.promotionPriceMinor !== undefined) {
      integerValue(r.promotionPriceMinor, `${variant}: precio promocional`);
      if (r.promotionPriceMinor >= r.priceMinor) fail(`${variant}: el precio promocional debe ser menor al precio normal.`);
    }
    for (const [key, label] of [['promotionStartsAt', 'inicio'], ['promotionEndsAt', 'fin']]) {
      const date = r[key];
      if (date !== null && date !== undefined && (typeof date !== 'string' || !Number.isFinite(Date.parse(date)))) fail(`${variant}: fecha de ${label} inválida.`);
    }
    if (r.promotionStartsAt && r.promotionEndsAt && Date.parse(r.promotionStartsAt) >= Date.parse(r.promotionEndsAt)) fail(`${variant}: el fin de la promoción debe ser posterior al inicio.`);
  });

  safeUrl(v.dimensionsMaterialsImage ?? '');
  if (v.link != null && v.link !== '#contacto') safeUrl(v.link);
  return v;
};
export const DEFAULT_SETTINGS = Object.freeze({ tabMode: 'collections', autoplayMs: 6500, featuredEnabled: true, signalText: 'MAKE / PRODUCE / MOVE / SHIFT', signalIcon: '' });
export const validateSettings = v => {
  if (!object(v) || Object.keys(v).some(k => !Object.hasOwn(DEFAULT_SETTINGS, k))) fail('Configuración desconocida.');
  const out = { ...DEFAULT_SETTINGS, ...v };
  if (!['collections', 'categories'].includes(out.tabMode)) fail('Agrupación inválida.');
  integerValue(out.autoplayMs, 'Duración', 3000, 60000);
  if (typeof out.featuredEnabled !== 'boolean') fail('Estado de destacados inválido.');
  textValue(out.signalText, 'Texto del cintillo', 160);
  if (typeof out.signalIcon !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(out.signalIcon) && out.signalIcon !== '') fail('Ícono del cintillo: usa únicamente el nombre de un ícono Bootstrap, por ejemplo “star-fill”.');
  if (!out.signalText && !out.signalIcon) fail('Escribe texto o indica un ícono Bootstrap para el cintillo.');
  return out;
};

export const featuredFromProduct = product => {
  const c = normalizeFeaturedConfig(product.featuredConfig);
  const catalogTag = product.tags?.find(tag => tag.active)?.name ?? '';
  return {
    id: product.id, databaseId: product.databaseId, productId: product.databaseId,
    Titulo1: c.title1 || catalogTag, Titulo2: c.title2 || product.title, Titulo1adj: c.title1Adj, Titulo2adj: c.title2Adj,
    Photo: c.imageUrl || product.photo, imageAlt: c.imageAlt || product.photoAlt,
    text: c.text || product.desc, LinkText: c.linkLabel || 'VER PRODUCTO →',
    LinkUrl: `/producto?id=${encodeURIComponent(product.id)}`, Line: c.showLine ? 'yes' : 'no',
    template: c.template, overlayColor: c.overlayColor, textColor: c.textColor, overlayOpacity: c.overlayOpacity,
    titleSize: c.titleSize, descriptionSize: c.descriptionSize, linkColor: c.linkColor, lineColor: c.lineColor, labelColor: c.labelColor,
  };
};
