import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { FEATURED_FIELDS, FEATURED_TEMPLATES, normalizeFeaturedConfig, validateContent, validateFeaturedConfig, validateSettings, featuredFromProduct } from '../shared/product-config.js';
import { FEATURED_ADJUSTMENT_FIELDS } from '../shared/featured-config.js';
import { paintFeatured } from './catalog.js';

const root = document.querySelector('[data-admin]'), workspace = root.querySelector('[data-admin-workspace]');
const nav = root.querySelector('[data-admin-nav]'), dialog = document.querySelector('[data-admin-dialog]'), confirmDialog = document.querySelector('[data-confirm-dialog]');
const form = dialog.querySelector('form'), fields = dialog.querySelector('[data-dialog-fields]'), errorLabel = dialog.querySelector('[data-form-error]');
const featuredPreviewPane = dialog.querySelector('[data-featured-preview-pane]');
const featuredPreviewContent = dialog.querySelector('[data-featured-preview-content]');
const featuredPreviewTitle = dialog.querySelector('[data-featured-preview-title]');
const featuredPreviewEyebrow = dialog.querySelector('[data-featured-preview-eyebrow]');
const fieldTooltip = document.querySelector('[data-field-tooltip]');
const titles = { products: 'Productos', collections: 'Colecciones', categories: 'Categorías', subcategories: 'Subcategorías', tags: 'Etiquetas', featured: 'Destacados', settings: 'Configuración', activity: 'Actividad' };
const ICON_OPTIONS = [
  { value: 'box-seam', label: 'Caja / empaque' }, { value: 'box', label: 'Caja' }, { value: 'rulers', label: 'Regla / medición' },
  { value: 'arrows-vertical', label: 'Alto / vertical' }, { value: 'arrows', label: 'Ancho / doble flecha' },
  { value: 'patch-check', label: 'Incluido / verificado' }, { value: 'check-circle', label: 'Confirmación' }, { value: 'x-circle', label: 'No incluido / excluir' }, { value: 'dash-circle', label: 'No aplica' }, { value: 'info-circle', label: 'Información' }, { value: 'circle', label: 'Elemento circular' },
  { value: 'archive', label: 'Archivo / contenedor' }, { value: 'boxes', label: 'Varias cajas' }, { value: 'disc', label: 'Disco / pieza' }, { value: 'stars', label: 'Especial' },
];
const iconHelp = kind => kind === 'dimensions'
  ? 'Elige un icono de medición: rulers para una regla, arrows-vertical para alto, arrows para ancho o box para profundidad.'
  : 'Elige un icono relacionado con el contenido: box-seam para empaque, patch-check para algo incluido, archive para contenedor o check-circle para confirmación.';
let snapshot, current = 'products', stateFilter = 'all', editor, saving = false;
const el = (tag, className = '', text) => { const n = document.createElement(tag); n.className = className; if (text !== undefined) n.textContent = String(text); return n; };
const button = (text, handler, primary = false) => { const b = el('button', primary ? 'admin-primary-action' : 'admin-secondary-action', text); b.type = 'button'; b.addEventListener('click', handler); return b; };
const money = p => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(p / 100);
const dateText = value => value ? new Date(value.endsWith('Z') || value.includes('T') ? value : `${value.replace(' ', 'T')}Z`).toLocaleString('es-MX') : '—';
const notify = message => { const t = document.querySelector('[data-admin-toast]'); t.textContent = message; t.classList.add('is-visible'); setTimeout(() => t.classList.remove('is-visible'), 4500); };
const request = async (path, method = 'GET', body) => {
  const r = await fetch(path, { method, headers: body ? { 'content-type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await r.json(); if (!r.ok) { const e = new Error(data.error); e.status = r.status; throw e; } return data;
};
let activeInfo = null;
const hideFieldHelp = () => { activeInfo = null; fieldTooltip.hidden = true; };
const showFieldHelp = info => {
  activeInfo = info;
  fieldTooltip.textContent = info.dataset.tooltip;
  fieldTooltip.hidden = false;
  const anchor = info.getBoundingClientRect(), margin = 12, gap = 9;
  const width = fieldTooltip.offsetWidth, height = fieldTooltip.offsetHeight;
  const left = Math.min(Math.max(anchor.left + anchor.width / 2 - width / 2, margin), window.innerWidth - width - margin);
  let top = anchor.top - height - gap;
  if (top < margin) top = anchor.bottom + gap;
  if (top + height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - height - margin);
  fieldTooltip.style.left = `${left}px`;
  fieldTooltip.style.top = `${top}px`;
};
fields.addEventListener('scroll', hideFieldHelp, { passive: true });
window.addEventListener('resize', () => activeInfo ? showFieldHelp(activeInfo) : undefined);
const fieldHelp = (name, label, type) => ({
  code: 'Usa un código único y permanente, por ejemplo: MOBILES_01.',
  slug: 'Usa minúsculas, números y guiones, por ejemplo: mobiles-01.',
  title: 'Escribe el nombre visible con el que se mostrará el producto.',
  name: 'Escribe un nombre claro y único para identificar este registro.',
  collectionId: 'Selecciona la colección a la que pertenece el producto.',
  categoryId: 'Selecciona la categoría principal del producto.',
  subcategoryId: 'Selecciona una subcategoría solo si ayuda a clasificar el producto.',
  price: 'Indica el precio normal en pesos mexicanos, por ejemplo: 1299.00.',
  stock: 'Indica un número entero de existencias disponibles.',
  sortOrder: 'Usa un número: los valores menores se muestran primero.',
  primaryImageUrl: 'Pega la URL pública y completa de la imagen principal.',
  primaryImageAlt: 'Describe brevemente qué aparece en la imagen para accesibilidad.',
  imageUrl: 'Pega la URL pública y completa de la imagen.',
  imageAlt: 'Describe brevemente qué aparece en la imagen.',
  tabLabel: 'Escribe el texto corto que aparecerá en la navegación.',
  signalIcon: 'Usa el nombre de un icono de Bootstrap, por ejemplo: star-fill.',
}[name] ?? (type === 'select' ? 'Selecciona una opción de la lista.' : type === 'number' ? 'Ingresa un valor numérico válido.' : type === 'textarea' ? `Escribe la información de ${label.toLowerCase()}.` : type === 'boolean' ? 'Activa la opción solo cuando deba aplicarse.' : `Completa ${label.toLowerCase()}.`));
const input = (name, label, value = '', type = 'text', options = [], attributes = {}) => {
  const wrapper = el('label', `admin-field${type === 'textarea' ? ' admin-field--wide' : ''}${type === 'boolean' ? ' admin-field--checkbox' : ''}`);
  const { help, requiredWhenActive, ...controlAttributes } = attributes;
  const labelLine = el('span', 'admin-field__label');
  labelLine.append(document.createTextNode(label));
  if (Object.hasOwn(controlAttributes, 'required') || requiredWhenActive !== undefined) {
    labelLine.append(el('b', 'admin-field__required', ' *'));
  }
  const info = el('span', 'admin-field__info', 'i');
  const guide = help ?? fieldHelp(name, label, type);
  info.tabIndex = 0;
  info.setAttribute('role', 'img');
  info.setAttribute('aria-label', guide);
  info.dataset.tooltip = guide;
  info.addEventListener('mouseenter', () => showFieldHelp(info));
  info.addEventListener('mouseleave', hideFieldHelp);
  info.addEventListener('focus', () => showFieldHelp(info));
  info.addEventListener('blur', hideFieldHelp);
  labelLine.append(info);
  wrapper.append(labelLine);
  const control = el(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  control.name = name;
  if (type === 'select') options.forEach(o => { const option = el('option', '', o.label ?? o); option.value = o.value ?? o; control.append(option); });
  else if (type !== 'textarea') control.type = type === 'boolean' ? 'checkbox' : type;
  if (type === 'boolean') control.checked = Boolean(value); else control.value = value ?? '';
  Object.entries(controlAttributes).forEach(([k, v]) => { if (v !== undefined) control.setAttribute(k, v); });
  wrapper.append(control); return wrapper;
};
const control = name => form.elements.namedItem(name);
const val = name => control(name)?.value ?? '';
const num = name => Number(val(name));
const checked = name => Boolean(control(name)?.checked);
const heading = (name, children, open = false) => {
  const d = el('details', 'admin-editor-section'); d.open = open;
  d.append(el('summary', '', name)); const group = el('div', 'admin-editor-grid'); group.append(...children); d.append(group); return d;
};
const catalogOptions = (resource, selected, predicate = () => true) => [
  { value: '', label: 'Seleccionar…' }, ...snapshot[resource].filter(r => (r.active || r.id === selected) && predicate(r)).map(r => ({ value: r.id, label: `${r.name}${r.active ? '' : ' (inactivo)'}` })),
];
const repeat = (name, title, values, columns, options = {}) => {
  const group = el('section', 'admin-repeater');
  group.dataset.fieldGroup = name;
  group.tabIndex = -1;
  const headingLabel = el('h4', '', title);
  if (options.requiredWhenActive) headingLabel.append(el('b', 'admin-field__required', ' *'));
  group.append(headingLabel);
  const items = el('div'); let sequence = 0;
  const add = (row = {}) => {
    const container = el('div', 'admin-repeater__row'), prefix = `${name}_${sequence++}_`;
    columns.forEach(c => container.append(input(prefix + c.key, c.label, row[c.key] ?? c.defaultValue ?? '', c.type ?? 'text', c.options ?? [], c.attributes ?? {})));
    container.append(button('Quitar', () => container.remove())); items.append(container);
  };
  values.forEach(add); group.append(items, button('Agregar', () => add()));
  return { node: group, read: () => [...items.children].map(row => Object.fromEntries(columns.map(c => {
    const field = row.querySelector(`[name$="_${c.key}"]`);
    if (c.type === 'boolean') return [c.key, field.checked];
    const v = field.value.trim();
    return [c.key, c.type === 'number' ? (v === '' ? null : Number(v)) : v];
  }))) };
};
const openEditor = (resource, record, title, children, serialize, preview = null) => {
  editor = { resource, record, serialize };
  dialog.querySelector('[data-dialog-title]').textContent = title;
  dialog.querySelector('[data-dialog-eyebrow]').textContent = record ? 'EDITAR / DATOS COMPARTIDOS' : 'ALTA';
  fields.replaceChildren(el('p', 'admin-form-note', 'Los campos marcados con * son obligatorios. En productos, algunos son necesarios para publicar.'), ...children);
  featuredPreviewContent.replaceChildren(...(preview ? [preview] : []));
  featuredPreviewPane.hidden = !preview;
  dialog.classList.toggle('admin-dialog--with-preview', Boolean(preview));
  errorLabel.hidden = true; dialog.showModal(); fields.querySelector('input,select,textarea')?.focus();
};
const inferredErrorFields = message => {
  const names = [];
  const add = name => { if ((control(name) || fields.querySelector(`[data-field-group="${name}"]`)) && !names.includes(name)) names.push(name); };
  if (/descripción corta/i.test(message)) add('shortDescription');
  if (/descripción completa/i.test(message)) add('longDescription');
  if (/imagen principal/i.test(message)) add('primaryImageUrl');
  if (/especificaci/i.test(message)) add('specifications');
  if (/código/i.test(message)) add('code');
  if (/\bslug\b/i.test(message)) add('slug');
  if (/\bprecio/i.test(message)) add('price');
  if (/\bcolección/i.test(message)) add('collectionId');
  if (/\bcategoría/i.test(message)) add('categoryId');
  if (/\bnombre/i.test(message)) add(control('title') ? 'title' : 'name');
  return names;
};
const revealFormIssues = names => {
  const targets = names.map(name => control(name)?.closest('.admin-field') ?? fields.querySelector(`[data-field-group="${name}"]`)).filter(Boolean);
  if (!targets.length) return;
  targets.forEach(target => {
    let section = target.closest('details');
    while (section) { section.open = true; section = section.parentElement.closest('details'); }
    target.classList.remove('is-error-highlight');
    void target.offsetWidth;
    target.classList.add('is-error-highlight');
    target.querySelectorAll('input, textarea, select').forEach(item => item.setAttribute('aria-invalid', 'true'));
    window.setTimeout(() => {
      target.classList.remove('is-error-highlight');
      target.querySelectorAll('[aria-invalid="true"]').forEach(item => item.removeAttribute('aria-invalid'));
    }, 2800);
  });
  const first = targets[0], focusTarget = first.querySelector('input, textarea, select, button') ?? first;
  requestAnimationFrame(() => {
    first.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    window.setTimeout(() => focusTarget.focus({ preventScroll: true }), 320);
  });
};
const validatePublication = payload => {
  if (editor.resource !== 'products' || !payload.active) return;
  const missing = [];
  if (!payload.shortDescription.trim()) missing.push(['shortDescription', 'descripción corta']);
  if (!payload.longDescription.trim()) missing.push(['longDescription', 'descripción completa']);
  if (!payload.primaryImageUrl.trim()) missing.push(['primaryImageUrl', 'imagen principal']);
  if (!payload.content.specifications?.length) missing.push(['specifications', 'al menos una especificación']);
  if (!missing.length) return;
  const error = new Error(`Para publicar el producto completa: ${missing.map(([, label]) => label).join(', ')}.`);
  error.fieldNames = missing.map(([name]) => name);
  throw error;
};
const cents = name => {
  const raw = val(name); if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Ingresa un precio positivo con hasta dos decimales.');
  const [whole, decimal = ''] = raw.split('.'); return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
};
const centsValue = (raw, label = 'precio') => {
  const value = String(raw ?? '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) throw new Error(`Ingresa un ${label} positivo con hasta dos decimales.`);
  const [whole, decimal = ''] = value.split('.'); return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
};
const localDate = value => {
  if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const isoDate = name => val(name) ? new Date(val(name)).toISOString() : null;
const isoDateValue = value => value ? new Date(value).toISOString() : null;
const createPreview = () => {
  const card = el('article', 'featured-card admin-featured-preview'); const image = el('img');
  const shade = el('div', 'featured-card__shade'), label = el('p', 'featured-card__label meta');
  const content = el('div', 'featured-card__content');
  const controls = el('div', 'featured-card__controls');
  const previewControl = icon => { const control = el('button'); control.type = 'button'; control.tabIndex = -1; control.setAttribute('aria-hidden', 'true'); control.append(el('i', `bi bi-${icon}`)); return control; };
  const dots = el('div', 'featured-card__dots'), activeDot = el('button', 'is-active'); activeDot.type = 'button'; activeDot.tabIndex = -1; activeDot.setAttribute('aria-hidden', 'true'); dots.append(activeDot);
  controls.append(previewControl('arrow-left'), dots, previewControl('arrow-right'));
  content.append(el('h3'), el('p'), el('a')); card.append(image, shade, label, content, controls);
  card.addEventListener('click', e => { if (e.target.closest('a,button')) e.preventDefault(); }); return card;
};
const createProductPreview = () => {
  const card = el('article', 'product-card admin-product-preview');
  const label = el('span', 'product-card__label meta');
  const image = el('img');
  const title = el('h3');
  const collection = el('p');
  const description = el('small');
  const link = el('a', '', 'INFORMACIÓN');
  link.href = '#';
  link.addEventListener('click', event => event.preventDefault());
  image.addEventListener('error', () => { image.dataset.failedUrl = image.src; image.hidden = true; card.classList.add('has-missing-image'); });
  card.append(label, image, title, collection, description, link);
  return card;
};
const editProduct = (p = null) => {
  const {
    details: _legacyDetails, story: _legacyStory, edition: _legacyEdition, badges: _legacyBadges,
    relatedProducts: _legacyRelated, dimensionsMaterialsAlt: _legacyDimensionsAlt, ...content
  } = p?.content ?? {};
  const config = normalizeFeaturedConfig(p?.featuredConfig);
  const gallery = repeat('gallery', 'Galería', content.gallery ?? [], [{ key: 'src', label: 'Ruta de imagen' }, { key: 'alt', label: 'Texto alternativo' }]);
  const specs = repeat('specifications', 'Especificaciones', content.specifications ?? [], [{ key: 'label', label: 'Nombre' }, { key: 'value', label: 'Valor' }], { requiredWhenActive: true });
  const includes = repeat('includes', 'Qué incluye', content.includes ?? [], [{ key: 'icon', label: 'Icono', type: 'select', options: ICON_OPTIONS, defaultValue: 'box-seam', attributes: { help: iconHelp('includes') } }, { key: 'text', label: 'Texto' }]);
  const excludes = repeat('excludes', 'Qué no incluye (opcional)', content.excludes ?? [], [{ key: 'icon', label: 'Icono', type: 'select', options: ICON_OPTIONS, defaultValue: 'x-circle', attributes: { help: 'Elige un icono que indique ausencia o exclusión, como x-circle, dash-circle o info-circle.' } }, { key: 'text', label: 'Texto' }]);
  const options = repeat('options', 'Opciones adicionales (sin precio propio)', (content.options ?? []).map(o => ({ ...o, values: o.values.join('\n') })), [{ key: 'label', label: 'Nombre' }, { key: 'values', label: 'Un valor por línea', type: 'textarea' }, { key: 'selected', label: 'Selección inicial (0 = primera)', type: 'number', defaultValue: 0, attributes: { min: 0, step: 1 } }]);
  const inheritedVariants = content.options?.[0]?.values?.map(value => ({
    value, priceMinor: p?.priceMinor ?? 0, stock: p?.stock ?? null,
    isPromotion: p?.isPromotion ?? false, promotionLabel: p?.promotionLabel ?? 'PROMOCIÓN',
    promotionPriceMinor: p?.promotionPriceMinor ?? null, promotionStartsAt: p?.promotionStartsAt ?? null, promotionEndsAt: p?.promotionEndsAt ?? null,
  })) ?? [];
  const variantRows = (content.variants?.length ? content.variants : inheritedVariants).map(variant => ({
    ...variant,
    price: variant.priceMinor / 100,
    promotionPrice: variant.promotionPriceMinor == null ? '' : variant.promotionPriceMinor / 100,
    promotionStartsAt: localDate(variant.promotionStartsAt),
    promotionEndsAt: localDate(variant.promotionEndsAt),
  }));
  const variants = repeat('variants', 'Variantes', variantRows, [
    { key: 'value', label: 'Nombre de la variante' },
    { key: 'price', label: 'Precio normal (MXN)', type: 'number', attributes: { min: 0, step: 0.01 } },
    { key: 'stock', label: 'Existencias (vacío: sobre pedido)', type: 'number', attributes: { min: 0, step: 1 } },
    { key: 'isPromotion', label: 'Esta variante tiene promoción', type: 'boolean' },
    { key: 'promotionLabel', label: 'Etiqueta promocional', defaultValue: 'PROMOCIÓN' },
    { key: 'promotionPrice', label: 'Precio promocional (MXN)', type: 'number', attributes: { min: 0, step: 0.01 } },
    { key: 'promotionStartsAt', label: 'Inicio de promoción', type: 'datetime-local' },
    { key: 'promotionEndsAt', label: 'Fin de promoción', type: 'datetime-local' },
  ]);
  const tagPicker = input('tagId','Etiqueta del producto', p?.tagIds?.[0] ?? '', 'select', [{ value: '', label: 'Sin etiqueta' }, ...snapshot.tags.filter(tag => tag.active || p?.tagIds?.includes(tag.id)).map(tag => ({ value: tag.id, label: `${tag.name}${tag.active ? '' : ' (inactiva)'}` }))], { help:'Selecciona una etiqueta. Se muestra en la ficha, en la tarjeta del catálogo y se utiliza para encontrar productos relacionados.' });
  const configuredFeaturedTag = snapshot.tags.find(tag => tag.name === config.title1);
  const featuredTagPicker = input('featuredTagId', 'Etiqueta del banner', configuredFeaturedTag?.id ?? '', 'select', [
    { value: '', label: 'Usar etiqueta del producto' },
    ...snapshot.tags.filter(tag => tag.active).map(tag => ({ value: tag.id, label: tag.name })),
  ], { help: 'Elige una etiqueta existente del catálogo. Si lo dejas vacío, se usará la etiqueta seleccionada para el producto.' });
  const editableFeaturedFields = FEATURED_FIELDS.filter(f => !['template', 'title1'].includes(f.key));
  const featureControls = editableFeaturedFields.map(f => input(`featured_${f.key}`, f.label, config[f.key], f.type, f.options ?? [], { min: f.min, max: f.max, step: f.step }));
  const readFeature = () => validateFeaturedConfig({ version: 1,
    template: val('featured_template'),
    title1: snapshot.tags.find(tag => String(tag.id) === val('featuredTagId'))?.name ?? '',
    ...Object.fromEntries(editableFeaturedFields.map(f => [f.key, f.type === 'boolean' ? checked(`featured_${f.key}`) : f.type === 'number' ? num(`featured_${f.key}`) : val(`featured_${f.key}`)])),
    ...Object.fromEntries(['title1Adj','title2Adj'].map(key => [key, Object.fromEntries(FEATURED_ADJUSTMENT_FIELDS.map(f => [f.key, f.type === 'boolean' ? checked(`${key}_${f.key}`) : val(`${key}_${f.key}`)]))])),
  });
  const thumbs = el('div', 'admin-template-picker');
  const templateInput = el('input'); templateInput.type = 'hidden'; templateInput.name = 'featured_template'; templateInput.value = config.template; thumbs.append(templateInput);
  FEATURED_TEMPLATES.forEach(t => {
    const b = button(t.name, () => { control('featured_template').value = t.id; refreshPreview(); });
    b.classList.add('admin-template-option');
    const choiceLabel = el('span', 'admin-template-option__label', t.name); choiceLabel.append(el('span', 'admin-template-option__check', '✓'));
    b.replaceChildren(choiceLabel); b.setAttribute('aria-label', `Plantilla ${t.name}`); b.dataset.templateChoice = t.id; thumbs.append(b);
  });
  const featuredCard = createPreview(), productCard = createProductPreview();
  const previewSwitch = el('div', 'admin-preview-switch'); previewSwitch.setAttribute('role', 'group'); previewSwitch.setAttribute('aria-label', 'Tamaño de vista previa');
  const previewDevice = el('section', 'admin-preview-device is-desktop');
  const setPreviewMode = mode => {
    previewDevice.classList.toggle('is-mobile', mode === 'mobile'); previewDevice.classList.toggle('is-desktop', mode === 'desktop');
    previewSwitch.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.previewMode === mode)));
  };
  for (const [name, mode] of [['Escritorio', 'desktop'], ['Móvil', 'mobile']]) {
    const modeButton = button(name, () => setPreviewMode(mode)); modeButton.dataset.previewMode = mode; modeButton.classList.add('admin-preview-switch__button'); previewSwitch.append(modeButton);
  }
  previewDevice.append(featuredCard);
  const previewScaleObserver = new ResizeObserver(([entry]) => previewDevice.style.setProperty('--admin-preview-scale', String(entry.contentRect.width / 800)));
  previewScaleObserver.observe(previewDevice);
  dialog.addEventListener('close', () => previewScaleObserver.disconnect(), { once: true });
  const featuredPreviewSection = el('section', 'admin-featured-preview-section'); featuredPreviewSection.append(previewSwitch, previewDevice);
  const productPreviewSection = el('section', 'admin-product-preview-section'); productPreviewSection.append(el('h4', '', 'Tarjeta en catálogo'), productCard);
  const previewPanel = el('div', 'admin-product-preview-stack'); previewPanel.append(featuredPreviewSection, productPreviewSection); setPreviewMode('desktop');
  const adjustmentSections = ['title1Adj','title2Adj'].map((key,i) => heading(i ? 'Ajustes del título' : 'Ajustes de la etiqueta', FEATURED_ADJUSTMENT_FIELDS.map(f => input(`${key}_${f.key}`, f.label, config[key][f.key], f.type, f.options))));
  const basics = [
    input('code','Código estable',p?.id ?? '', 'text', [], { required: '', ...(p ? { readonly: '' } : {}) }),
    input('slug','Slug estable',p?.slug ?? '', 'text', [], { required: '', ...(p ? { readonly: '' } : {}) }),
    input('title','Nombre',p?.title ?? '', 'text', [], { required: '' }), input('label','Etiqueta editorial (NEW, SERIES…)',p?.label),
    input('shortDescription','Descripción corta',p?.desc,'textarea',[],{ requiredWhenActive: '', help: 'Obligatoria para publicar: resume el producto en una o dos frases.' }), input('longDescription','Descripción completa',p?.longDescription,'textarea',[],{ requiredWhenActive: '', help: 'Obligatoria para publicar: explica las características y el contexto del producto.' }),
    input('primaryImageUrl','Imagen principal',p?.photo,'text',[],{ requiredWhenActive: '', help: 'Obligatoria para publicar: pega una URL pública y completa de la imagen.' }), input('primaryImageAlt','Texto alternativo',p?.photoAlt),
    input('collectionId','Colección',p?.collectionId,'select',catalogOptions('collections',p?.collectionId), { required: '' }),
    input('categoryId','Categoría',p?.categoryId,'select',catalogOptions('categories',p?.categoryId), { required: '' }),
    input('subcategoryId','Subcategoría (opcional)',p?.subcategoryId,'select',catalogOptions('subcategories',p?.subcategoryId,r => r.categoryId === p?.categoryId)),
    input('sortOrder','Orden',p?.sortOrder ?? 0,'number',[],{ min:0,step:1 }), input('active','Activo / visible si sus catálogos están activos',p?.active ?? false,'boolean'),
  ];
  const sale = [input('price','Precio normal (MXN)', (p?.priceMinor ?? 0)/100,'number',[],{ required:'', min:0,step:0.01 }),
    input('stock','Existencias',p?.stock ?? '','number',[],{ min:0,step:1 }), input('isPromotion','En promoción',p?.isPromotion ?? false,'boolean'),
    input('promotionLabel','Etiqueta promocional',p?.promotionLabel ?? 'PROMOCIÓN'), input('promotionPrice','Precio promocional opcional (MXN)',p?.promotionPriceMinor == null ? '' : p.promotionPriceMinor/100,'number',[],{ min:0,step:0.01 }),
    input('promotionStartsAt','Inicio de promoción (hora local)',localDate(p?.promotionStartsAt),'datetime-local'), input('promotionEndsAt','Fin de promoción (hora local)',localDate(p?.promotionEndsAt),'datetime-local')];
  const dimensionRows = Array.isArray(content.dimensions) ? content.dimensions : Object.entries(content.dimensions ?? {}).map(([key, value]) => ({ icon: key === 'height' ? 'arrows-vertical' : key === 'width' ? 'arrows' : 'box', title: key === 'height' ? 'Alto' : key === 'width' ? 'Ancho' : 'Profundidad', value }));
  const dimensionsRepeater = repeat('dimensions', 'Medidas de respaldo', dimensionRows, [{ key: 'icon', label: 'Icono', type: 'select', options: ICON_OPTIONS, defaultValue: 'rulers', attributes: { help: iconHelp('dimensions') } }, { key: 'title', label: 'Título', defaultValue: 'Medida' }, { key: 'value', label: 'Valor' }]);
  const dimensions = [input('dimensionsMaterialsImage','Imagen de dimensiones/materiales',content.dimensionsMaterialsImage,'text',[],{ help:'Pega una imagen técnica. Si no carga, la ficha mostrará automáticamente las medidas capturadas abajo.' }), dimensionsRepeater.node];
  openEditor('products',p,p?.title ?? 'Nuevo producto',[
    heading('Información y clasificación',basics,true), heading('Precio general y promoción de respaldo',sale),
    heading('Variantes por color u opción',[input('variantLabel','Nombre de la opción',content.variantLabel ?? content.options?.[0]?.label ?? 'Color','text',[],{ help:'Ejemplo: Color. Cada variante puede tener precio, existencias y promoción propios.' }),variants.node]),
    heading('Galería y especificaciones',[gallery.node,specs.node]),
    heading('Etiquetas y relaciones',[tagPicker]), heading('Dimensiones y materiales',dimensions), heading('Contenido de la ficha',[includes.node,excludes.node,options.node]),
    heading('Destacado',[input('isFeatured','Mostrar este producto como destacado',p?.isFeatured ?? false,'boolean'),input('featuredOrder','Orden en destacados',p?.featuredOrder ?? 0,'number',[],{min:0,step:1}),featuredTagPicker,thumbs,...featureControls,...adjustmentSections]),
  ], () => ({ code:val('code'),slug:val('slug'),title:val('title'),label:val('label'),shortDescription:val('shortDescription'),longDescription:val('longDescription'),
    primaryImageUrl:val('primaryImageUrl'),primaryImageAlt:val('primaryImageAlt'),collectionId:num('collectionId'),categoryId:num('categoryId'),subcategoryId:val('subcategoryId') ? num('subcategoryId') : null,
    sortOrder:num('sortOrder'),active:checked('active'),priceMinor:cents('price'),currency:'MXN',stock:val('stock') === '' ? null : num('stock'),isPromotion:checked('isPromotion'),promotionLabel:val('promotionLabel'),
    promotionPriceMinor:val('promotionPrice') === '' ? null : cents('promotionPrice'),promotionStartsAt:isoDate('promotionStartsAt'),promotionEndsAt:isoDate('promotionEndsAt'),
    tagId:val('tagId') ? Number(val('tagId')) : null,
    isFeatured:checked('isFeatured'),featuredOrder:num('featuredOrder'),featuredConfig:readFeature(),
    content:validateContent({ ...content, gallery:gallery.read(),specifications:specs.read(),includes:includes.read(),excludes:excludes.read(),
      variantLabel:val('variantLabel'),variants:variants.read().map(variant=>({
        value:variant.value,priceMinor:centsValue(variant.price,'precio normal'),stock:variant.stock == null ? null : variant.stock,
        isPromotion:variant.isPromotion,promotionLabel:variant.promotionLabel || 'PROMOCIÓN',
        promotionPriceMinor:variant.promotionPrice == null ? null : centsValue(variant.promotionPrice,'precio promocional'),
        promotionStartsAt:isoDateValue(variant.promotionStartsAt),promotionEndsAt:isoDateValue(variant.promotionEndsAt),
      })),
      options:options.read().map(o=>({...o,values:o.values.split('\n').map(s=>s.trim()).filter(Boolean)})),
      dimensionsMaterialsImage:val('dimensionsMaterialsImage'),dimensions:dimensionsRepeater.read() }),
  }), previewPanel);
  control('categoryId').addEventListener('change',()=>{
    const select=control('subcategoryId'); select.replaceChildren();
    catalogOptions('subcategories',null,r=>r.categoryId===num('categoryId')).forEach(o=>{const option=el('option','',o.label);option.value=o.value;select.append(option);});
  });
  function refreshPreview() {
    try {
      const c=readFeature();
      const selectedTag = snapshot.tags.find(tag => String(tag.id) === val('tagId'));
      const slide=featuredFromProduct({id:val('code'),title:val('title'),label:val('label'),desc:val('shortDescription'),photo:val('primaryImageUrl'),photoAlt:val('primaryImageAlt'),tags:selectedTag ? [selectedTag] : [],featuredConfig:c});
      paintFeatured(featuredCard,slide);
      const image = productCard.querySelector('img'), label = productCard.querySelector('.product-card__label');
      const imageUrl = val('primaryImageUrl');
      if (image.dataset.source !== imageUrl) { image.dataset.source = imageUrl; delete image.dataset.failedUrl; image.src = imageUrl; }
      const imageFailed = !imageUrl || image.dataset.failedUrl === image.src;
      productCard.classList.toggle('has-missing-image', imageFailed); image.hidden = imageFailed; image.alt = val('primaryImageAlt') || val('title');
      label.textContent = checked('isPromotion') ? val('promotionLabel') : selectedTag?.name ?? ''; label.hidden = !label.textContent;
      productCard.querySelector('h3').textContent = val('title') || 'Nombre del producto';
      productCard.querySelector('p').textContent = snapshot.collections.find(item => String(item.id) === val('collectionId'))?.name ?? 'Colección';
      productCard.querySelector('small').textContent = val('shortDescription') || 'Descripción corta del producto.';
      productCard.querySelector('a').setAttribute('aria-label', `Información de ${val('title') || 'producto'}`);
      thumbs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.templateChoice===c.template)));
      const enabled = checked('isFeatured');
      featuredPreviewSection.hidden = !enabled; previewPanel.classList.toggle('is-featured-disabled', !enabled);
      featuredPreviewTitle.textContent = enabled ? 'Vista previa destacado' : 'Vista previa del producto';
      featuredPreviewEyebrow.textContent = enabled ? 'PRODUCTO DESTACADO' : 'PRODUCTO';
    } catch { /* Incomplete input is validated on submit; keep the last good preview. */ }
  }
  fields.oninput=refreshPreview; fields.onchange=refreshPreview; refreshPreview();
};
const editTaxonomy = (resource, item=null) => {
  fields.oninput=null; fields.onchange=null;
  if (resource === 'tags') {
    openEditor(resource,item,item?.name ?? 'Nueva etiqueta',[
      input('name','Nombre',item?.name,'text',[],{required:''}),input('slug','Slug',item?.slug,'text',[],{required:''}),
      input('sortOrder','Orden',item?.sortOrder??0,'number',[],{min:0,step:1}),input('active','Activa',item?.active??true,'boolean'),
    ],()=>({name:val('name'),slug:val('slug'),sortOrder:num('sortOrder'),active:checked('active')}));
    return;
  }
  openEditor(resource,item,item?.name ?? `Alta: ${titles[resource]}`,[
    input('name','Nombre',item?.name,'text',[],{required:''}),input('slug','Slug',item?.slug,'text',[],{required:''}),
    ...(resource==='subcategories'?[input('categoryId','Categoría',item?.categoryId,'select',catalogOptions('categories',item?.categoryId),{required:''})]:[]),
    input('description','Descripción',item?.description,'textarea'),input('imageUrl','Imagen',item?.imageUrl),input('imageAlt','Texto alternativo',item?.imageAlt),
    input('tabLabel','Etiqueta de navegación',item?.tabLabel),input('sortOrder','Orden',item?.sortOrder??0,'number',[],{min:0,step:1}),
    input('showInNav','Mostrar en navegación',item?.showInNav??true,'boolean'),input('active','Activo',item?.active??true,'boolean'),
  ],()=>({name:val('name'),slug:val('slug'),description:val('description'),imageUrl:val('imageUrl'),imageAlt:val('imageAlt'),tabLabel:val('tabLabel'),sortOrder:num('sortOrder'),showInNav:checked('showInNav'),active:checked('active'),...(resource==='subcategories'?{categoryId:num('categoryId')}:{})}));
};
const editSettings=()=>{
  fields.oninput=null;fields.onchange=null; const s=snapshot.settings;
  openEditor('settings',s,'Configuración del catálogo',[
    input('tabMode','Agrupar tabs por',s.value.tabMode,'select',[{value:'collections',label:'Colecciones'},{value:'categories',label:'Categorías'}]),
    input('autoplayMs','Cambio de banner (milisegundos)',s.value.autoplayMs,'number',[],{min:3000,max:60000,step:500}),
    input('featuredEnabled','Mostrar carrusel de destacados',s.value.featuredEnabled,'boolean'),input('active','Configuración activa',s.active,'boolean'),
    input('signalText','Texto del cintillo superior',s.value.signalText),input('signalIcon','Ícono Bootstrap opcional',s.value.signalIcon,'text',[],{placeholder:'Ejemplo: star-fill'}),
  ],()=>({value:validateSettings({tabMode:val('tabMode'),autoplayMs:num('autoplayMs'),featuredEnabled:checked('featuredEnabled'),signalText:val('signalText'),signalIcon:val('signalIcon')}),active:checked('active')}));
};
const confirmAction = (title, message, action = 'Confirmar', danger = false) => new Promise(resolve => {
  confirmDialog.querySelector('[data-confirm-title]').textContent = title;
  confirmDialog.querySelector('[data-confirm-message]').textContent = message;
  confirmDialog.querySelector('[data-confirm-submit]').textContent = action;
  confirmDialog.classList.toggle('is-danger', danger);
  const finish = event => { confirmDialog.removeEventListener('close', finish); resolve(confirmDialog.returnValue === 'confirm'); };
  confirmDialog.addEventListener('close', finish);
  confirmDialog.showModal();
});
const setActive=async(resource,item)=>{
  const action = item.active ? 'Desactivar' : 'Reactivar';
  if (!await confirmAction(`${action} ${item.title??item.name??'configuración'}?`, item.active ? 'El registro dejará de mostrarse, pero conservará toda su información.' : 'El registro volverá a estar disponible en el catálogo.', action, item.active)) return;
  try { await request(`/api/admin/${resource}/${item.databaseId??item.id}/${item.active?'deactivate':'reactivate'}`,'POST',{version:item.version});await refresh();notify('Estado actualizado.'); }
  catch(e){notify(e.message);}
};
const renderTable=(items,columns,resource)=>{
  if(!items.length)return el('p','admin-empty','No hay registros con este filtro.');
  const wrap=el('div','admin-table-wrap'),table=el('table','admin-table'),head=el('thead'),tr=el('tr'),body=el('tbody');
  columns.forEach(c=>tr.append(el('th','',c[0])));if(resource)tr.append(el('th','','Acciones'));head.append(tr);
  items.forEach(item=>{const row=el('tr');columns.forEach(([label,read])=>{const cell=el('td'),value=read(item);cell.dataset.label=label;value instanceof Node?cell.append(value):cell.textContent=value??'—';row.append(cell);});
    if(resource){const cell=el('td','admin-table__actions');cell.dataset.label='Acciones';cell.append(button('Editar',()=>resource==='products'?editProduct(item):editTaxonomy(resource,item)),button(item.active?'Desactivar':'Reactivar',()=>setActive(resource,item)));row.append(cell);}body.append(row);});
  table.append(head,body);wrap.append(table);return wrap;
};
const render=()=>{
  workspace.replaceChildren();root.querySelector('[data-admin-title]').textContent=titles[current];
  nav.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',b.dataset.section===current));
  const toolbar=el('div','admin-section__toolbar');workspace.append(toolbar);
  const resource=current==='featured'?'products':current;
  if(['products','collections','categories','subcategories','tags','featured'].includes(current)){
    const filter=input('stateFilter','Estado',stateFilter,'select',[{value:'all',label:'Todos'},{value:'active',label:'Activos'},{value:'inactive',label:'Inactivos'}]);
    filter.querySelector('select').addEventListener('change',e=>{stateFilter=e.target.value;render();});toolbar.append(filter);
    toolbar.append(button(current==='featured'?'Elegir producto':'Nuevo registro',()=>current==='featured'?chooseFeatured():resource==='products'?editProduct():editTaxonomy(resource),true));
    let items=snapshot[resource].filter(x=>stateFilter==='all'||x.active===(stateFilter==='active'));
    if(current==='featured')items=items.filter(p=>p.isFeatured);
    const status=p=>p.active?(p.visible===false?'Oculto por catálogo inactivo':'Activo'):'Inactivo';
    workspace.append(renderTable(items,resource==='products'?[
      ['Producto',p=>p.title],['Colección',p=>p.Collection],['Precio',p=>money(p.priceMinor)],['Promoción',p=>p.promotionActive?'Vigente':p.isPromotion?'Programada / vencida':'No'],['Destacado',p=>p.isFeatured?'Sí':'No'],['Estado',status],
    ]:[['Nombre',p=>p.name],...(resource==='subcategories'?[['Categoría',p=>p.categoryName]]:[]),['Orden',p=>p.sortOrder],['Estado',status]],resource));
    if(current==='featured')renderPending();
  }else if(current==='settings'){
    toolbar.append(el('p','','Las tabs se generan desde los catálogos activos. “Todos” no necesita un registro.'),button('Editar configuración',editSettings,true));
    workspace.append(el('p','',`Tabs por ${titles[snapshot.settings.value.tabMode].toLowerCase()} · Carrusel: ${snapshot.settings.value.featuredEnabled?'activo':'oculto'} · ${snapshot.settings.value.autoplayMs/1000} segundos`));
  }else{
    toolbar.append(el('p','','Últimos 100 eventos. Historial de solo lectura; incluye valores anteriores y posteriores.'));
    workspace.append(renderTable(snapshot.audit,[['Fecha',p=>dateText(p.createdAt)],['Responsable',p=>p.actorEmail||p.actorId],['Registro',p=>`${p.entityType} / ${p.entityId}`],['Acción',p=>p.action],['Cambios',p=>{const d=el('details');d.append(el('summary','','Ver detalle'),el('pre','admin-audit-json',JSON.stringify({antes:p.beforeJson?JSON.parse(p.beforeJson):null,despues:p.afterJson?JSON.parse(p.afterJson):null},null,2)));return d; }]]));
  }
};
const chooseFeatured=()=>{
  const available=snapshot.products.filter(p=>!p.isFeatured);
  if(!available.length){notify('Todos los productos ya están destacados.');return;}
  fields.oninput=null;fields.onchange=null;
  openEditor('choose',null,'Elegir producto',[input('chosen','Producto','','select',[{value:'',label:'Seleccionar…'},...available.map(p=>({value:p.databaseId,label:p.title}))],{required:''})],()=>({id:num('chosen')}));
};
const renderPending=()=>{
  const pending=snapshot.pendingFeatured.filter(d=>!d.assignedProductId);
  if(!pending.length)return;
  const section=el('section','admin-pending');section.append(el('h2','','Banners anteriores pendientes de asociación'),el('p','','Estos banners eran de colecciones. Elige el producto que representarán; el botón pasará a su ficha y el original quedará conservado.'));
  pending.forEach(d=>{
    const row=el('div','admin-pending-row');row.append(el('strong','',d.id));
    const pick=input('assign','Producto','','select',[{value:'',label:'Seleccionar producto…'},...snapshot.products.filter(p=>!p.isFeatured).map(p=>({value:p.databaseId,label:p.title}))]);
    row.append(pick,button('Asociar',async()=>{
      const p=snapshot.products.find(x=>x.databaseId===Number(pick.querySelector('select').value));if(!p){notify('Selecciona un producto.');return;}
      if(!window.confirm(`Asociar ${d.id} a ${p.title}? Su enlace abrirá la ficha de este producto.`))return;
      try{await request('/api/admin/assign-featured','POST',{legacyId:d.id,productId:p.databaseId,productVersion:p.version,pendingVersion:snapshot.pendingVersion});await refresh();notify('Banner asociado; ya puedes personalizarlo desde el producto.');}catch(e){notify(e.message);}
    }));section.append(row);
  });workspace.append(section);
};
async function refresh(){snapshot=await request('/api/admin/bootstrap');render();}
nav.replaceChildren(...Object.entries(titles).map(([key,label])=>{const b=button(label,()=>{current=key;stateFilter='all';render();});b.dataset.section=key;return b;}));
dialog.querySelectorAll('[data-dialog-close]').forEach(b=>b.addEventListener('click',()=>{if(!saving)dialog.close();}));
dialog.addEventListener('cancel',event=>{if(saving)event.preventDefault();});
form.addEventListener('submit',async e=>{
  e.preventDefault();if(saving)return;
  try{
    const payload=editor.serialize();
    if(editor.resource==='choose'){const p=snapshot.products.find(x=>x.databaseId===payload.id);dialog.close();editProduct(p);return;}
    validatePublication(payload);
    saving=true;form.querySelector('[data-dialog-submit]').disabled=true;
    const id=editor.record?.databaseId??editor.record?.id;
    await request(`/api/admin/${editor.resource}${id?`/${id}`:''}`,id?'PUT':'POST',{...payload,...(id?{version:editor.record.version}:{})});
    dialog.close();await refresh();notify('Cambios guardados.');
  }catch(e){errorLabel.textContent=e.message;errorLabel.hidden=false;revealFormIssues(e.fieldNames ?? inferredErrorFields(e.message));}
  finally{saving=false;form.querySelector('[data-dialog-submit]').disabled=false;}
});
form.addEventListener('invalid', e => {
  let section=e.target.closest('details');while(section){section.open=true;section=section.parentElement.closest('details');}
}, true);
try{
  await refresh();workspace.hidden=false;root.querySelector('[data-admin-health]').textContent='Catálogo conectado';root.querySelector('[data-admin-actor]').textContent=snapshot.actor.email??snapshot.actor.id;
}catch(e){
  const auth=root.querySelector('[data-admin-auth]');auth.hidden=false;auth.querySelector('h2').textContent=e.message;
  root.querySelector('[data-admin-health]').textContent='Acceso pendiente';
}finally{root.querySelector('[data-admin-loading]').hidden=true;document.body.classList.add('is-ready');}
