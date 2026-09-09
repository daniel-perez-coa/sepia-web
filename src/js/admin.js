import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { FEATURED_FIELDS, FEATURED_TEMPLATES, normalizeFeaturedConfig, validateContent, validateFeaturedConfig, validateSettings, featuredFromProduct } from '../shared/product-config.js';
import { FEATURED_ADJUSTMENT_FIELDS } from '../shared/featured-config.js';
import { paintFeatured } from './catalog.js';

const root = document.querySelector('[data-admin]'), workspace = root.querySelector('[data-admin-workspace]');
const nav = root.querySelector('[data-admin-nav]'), dialog = document.querySelector('[data-admin-dialog]');
const form = dialog.querySelector('form'), fields = dialog.querySelector('[data-dialog-fields]'), errorLabel = dialog.querySelector('[data-form-error]');
const titles = { products: 'Productos', collections: 'Colecciones', categories: 'Categorías', subcategories: 'Subcategorías', featured: 'Destacados', settings: 'Configuración', activity: 'Actividad' };
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
const input = (name, label, value = '', type = 'text', options = [], attributes = {}) => {
  const wrapper = el('label', `admin-field${type === 'textarea' ? ' admin-field--wide' : ''}${type === 'boolean' ? ' admin-field--checkbox' : ''}`);
  wrapper.append(el('span', '', label));
  const control = el(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  control.name = name;
  if (type === 'select') options.forEach(o => { const option = el('option', '', o.label ?? o); option.value = o.value ?? o; control.append(option); });
  else if (type !== 'textarea') control.type = type === 'boolean' ? 'checkbox' : type;
  if (type === 'boolean') control.checked = Boolean(value); else control.value = value ?? '';
  Object.entries(attributes).forEach(([k, v]) => { if (v !== undefined) control.setAttribute(k, v); });
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
const repeat = (name, title, values, columns) => {
  const group = el('section', 'admin-repeater'); group.append(el('h4', '', title)); const items = el('div'); let sequence = 0;
  const add = (row = {}) => {
    const container = el('div', 'admin-repeater__row'), prefix = `${name}_${sequence++}_`;
    columns.forEach(c => container.append(input(prefix + c.key, c.label, row[c.key] ?? c.defaultValue ?? '', c.type ?? 'text', c.options ?? [], c.attributes ?? {})));
    container.append(button('Quitar', () => container.remove())); items.append(container);
  };
  values.forEach(add); group.append(items, button('Agregar', () => add()));
  return { node: group, read: () => [...items.children].map(row => Object.fromEntries(columns.map(c => {
    const v = row.querySelector(`[name$="_${c.key}"]`).value;
    return [c.key, c.type === 'number' ? Number(v) : v.trim()];
  }))) };
};
const openEditor = (resource, record, title, children, serialize) => {
  editor = { resource, record, serialize };
  dialog.querySelector('[data-dialog-title]').textContent = title;
  dialog.querySelector('[data-dialog-eyebrow]').textContent = record ? 'EDITAR / DATOS COMPARTIDOS' : 'ALTA';
  fields.replaceChildren(...children); errorLabel.hidden = true; dialog.showModal(); fields.querySelector('input,select,textarea')?.focus();
};
const cents = name => {
  const raw = val(name); if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) throw new Error('Ingresa un precio positivo con hasta dos decimales.');
  const [whole, decimal = ''] = raw.split('.'); return Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
};
const localDate = value => {
  if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const isoDate = name => val(name) ? new Date(val(name)).toISOString() : null;
const createPreview = () => {
  const card = el('article', 'featured-card admin-featured-preview'); const image = el('img');
  const shade = el('div', 'featured-card__shade'), label = el('p', 'featured-card__label meta');
  const content = el('div', 'featured-card__content');
  content.append(el('h3'), el('p'), el('a')); card.append(image, shade, label, content);
  card.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); }); return card;
};
const editProduct = (p = null) => {
  const content = p?.content ?? {}, config = normalizeFeaturedConfig(p?.featuredConfig);
  const gallery = repeat('gallery', 'Galería', content.gallery ?? [], [{ key: 'src', label: 'Ruta de imagen' }, { key: 'alt', label: 'Texto alternativo' }]);
  const facts = key => repeat(key, key === 'details' ? 'Detalles' : 'Especificaciones', content[key] ?? [], [{ key: 'label', label: 'Nombre' }, { key: 'value', label: 'Valor' }]);
  const details = facts('details'), specs = facts('specifications');
  const includes = repeat('includes', 'Qué incluye', content.includes ?? [], [{ key: 'icon', label: 'Icono (box, circle, archive…)', defaultValue: 'box' }, { key: 'text', label: 'Texto' }]);
  const options = repeat('options', 'Opciones del producto', (content.options ?? []).map(o => ({ ...o, values: o.values.join('\n') })), [{ key: 'label', label: 'Nombre' }, { key: 'values', label: 'Un valor por línea', type: 'textarea' }, { key: 'selected', label: 'Selección inicial (0 = primera)', type: 'number', defaultValue: 0, attributes: { min: 0, step: 1 } }]);
  const featureControls = FEATURED_FIELDS.map(f => input(`featured_${f.key}`, f.label, config[f.key], f.type, f.key === 'template' ? FEATURED_TEMPLATES.map(t => ({ value: t.id, label: t.name })) : f.options ?? [], { min: f.min, max: f.max, step: f.step }));
  const readFeature = () => validateFeaturedConfig({ version: 1,
    ...Object.fromEntries(FEATURED_FIELDS.map(f => [f.key, f.type === 'boolean' ? checked(`featured_${f.key}`) : f.type === 'number' ? num(`featured_${f.key}`) : val(`featured_${f.key}`)])),
    ...Object.fromEntries(['title1Adj','title2Adj'].map(key => [key, Object.fromEntries(FEATURED_ADJUSTMENT_FIELDS.map(f => [f.key, f.type === 'boolean' ? checked(`${key}_${f.key}`) : val(`${key}_${f.key}`)]))])),
  });
  const thumbs = el('div', 'admin-template-picker');
  FEATURED_TEMPLATES.forEach(t => {
    const b = button(t.name, () => { control('featured_template').value = t.id; refreshPreview(); });
    const miniature = el('span', 'admin-template-miniature'); miniature.dataset.position = t.position;
    miniature.append(el('span', '', 'Título\nDescripción')); b.prepend(miniature); b.dataset.templateChoice = t.id; thumbs.append(b);
  });
  const desktop = createPreview(), mobile = createPreview();
  const previews = el('div', 'admin-preview-grid');
  for (const [name, card, mode] of [['Escritorio', desktop, 'desktop'], ['Móvil', mobile, 'mobile']]) {
    const wrapper = el('section', `admin-preview-device is-${mode}`); wrapper.append(el('h4', '', name), card); previews.append(wrapper);
  }
  const adjustmentSections = ['title1Adj','title2Adj'].map((key,i) => heading(i ? 'Ajustes del título' : 'Ajustes de la etiqueta', FEATURED_ADJUSTMENT_FIELDS.map(f => input(`${key}_${f.key}`, f.label, config[key][f.key], f.type, f.options))));
  const basics = [
    input('code','Código estable',p?.id ?? '', 'text', [], { required: '', ...(p ? { readonly: '' } : {}) }),
    input('slug','Slug estable',p?.slug ?? '', 'text', [], { required: '', ...(p ? { readonly: '' } : {}) }),
    input('title','Nombre',p?.title ?? '', 'text', [], { required: '' }), input('label','Etiqueta editorial (NEW, SERIES…)',p?.label),
    input('shortDescription','Descripción corta',p?.desc,'textarea'), input('longDescription','Descripción completa',p?.longDescription,'textarea'),
    input('primaryImageUrl','Imagen principal',p?.photo), input('primaryImageAlt','Texto alternativo',p?.photoAlt),
    input('collectionId','Colección',p?.collectionId,'select',catalogOptions('collections',p?.collectionId), { required: '' }),
    input('categoryId','Categoría',p?.categoryId,'select',catalogOptions('categories',p?.categoryId), { required: '' }),
    input('subcategoryId','Subcategoría (opcional)',p?.subcategoryId,'select',catalogOptions('subcategories',p?.subcategoryId,r => r.categoryId === p?.categoryId)),
    input('sortOrder','Orden',p?.sortOrder ?? 0,'number',[],{ min:0,step:1 }), input('active','Activo / visible si sus catálogos están activos',p?.active ?? false,'boolean'),
  ];
  const sale = [input('price','Precio normal (MXN)', (p?.priceMinor ?? 0)/100,'number',[],{ required:'', min:0,step:0.01 }),
    input('stock','Existencias',p?.stock ?? 0,'number',[],{ min:0,step:1,required:'' }), input('isPromotion','En promoción',p?.isPromotion ?? false,'boolean'),
    input('promotionLabel','Etiqueta promocional',p?.promotionLabel ?? 'PROMOCIÓN'), input('promotionPrice','Precio promocional opcional (MXN)',p?.promotionPriceMinor == null ? '' : p.promotionPriceMinor/100,'number',[],{ min:0,step:0.01 }),
    input('promotionStartsAt','Inicio de promoción (hora local)',localDate(p?.promotionStartsAt),'datetime-local'), input('promotionEndsAt','Fin de promoción (hora local)',localDate(p?.promotionEndsAt),'datetime-local')];
  const story = [input('storyEyebrow','Historia: etiqueta',content.story?.eyebrow), input('storyTitle','Historia: título',content.story?.title), input('storyText','Historia: texto',content.story?.text,'textarea'),
    input('badges','Etiquetas de la ficha (una por línea)',(content.badges ?? []).join('\n'),'textarea'),
    input('editionLabel','Edición: etiqueta (vacío: sin edición)',content.edition?.label), input('editionCurrent','Número de edición',content.edition?.current ?? 0,'number',[],{ min:0,step:1 }), input('editionTotal','Total de edición',content.edition?.total ?? 1,'number',[],{ min:1,step:1 }),
    input('dimensionsMaterialsImage','Imagen de dimensiones/materiales',content.dimensionsMaterialsImage), input('dimensionsMaterialsAlt','Texto alternativo',content.dimensionsMaterialsAlt),
    input('relatedProducts','Productos relacionados',(content.relatedProducts ?? []).join(','),'select',snapshot.products.filter(x=>x.id!==p?.id).map(x=>({value:x.id,label:x.title})),{ multiple:'',size:5 })];
  openEditor('products',p,p?.title ?? 'Nuevo producto',[
    heading('Información y clasificación',basics,true), heading('Precio y promoción',sale), heading('Galería y especificaciones',[gallery.node,details.node,specs.node]),
    heading('Contenido de la ficha',[...story,includes.node,options.node]),
    heading('Destacado',[input('isFeatured','Mostrar este producto como destacado',p?.isFeatured ?? false,'boolean'),input('featuredOrder','Orden en destacados',p?.featuredOrder ?? 0,'number',[],{min:0,step:1}),thumbs,...featureControls,...adjustmentSections,previews]),
  ], () => ({ code:val('code'),slug:val('slug'),title:val('title'),label:val('label'),shortDescription:val('shortDescription'),longDescription:val('longDescription'),
    primaryImageUrl:val('primaryImageUrl'),primaryImageAlt:val('primaryImageAlt'),collectionId:num('collectionId'),categoryId:num('categoryId'),subcategoryId:val('subcategoryId') ? num('subcategoryId') : null,
    sortOrder:num('sortOrder'),active:checked('active'),priceMinor:cents('price'),currency:'MXN',stock:num('stock'),isPromotion:checked('isPromotion'),promotionLabel:val('promotionLabel'),
    promotionPriceMinor:val('promotionPrice') === '' ? null : cents('promotionPrice'),promotionStartsAt:isoDate('promotionStartsAt'),promotionEndsAt:isoDate('promotionEndsAt'),
    isFeatured:checked('isFeatured'),featuredOrder:num('featuredOrder'),featuredConfig:readFeature(),
    content:validateContent({ ...content, gallery:gallery.read(),details:details.read(),specifications:specs.read(),includes:includes.read(),
      options:options.read().map(o=>({...o,values:o.values.split('\n').map(s=>s.trim()).filter(Boolean)})),
      story:{eyebrow:val('storyEyebrow'),title:val('storyTitle'),text:val('storyText')},badges:val('badges').split('\n').map(s=>s.trim()).filter(Boolean),
      edition:val('editionLabel') ? {label:val('editionLabel'),current:num('editionCurrent'),total:num('editionTotal')} : null,
      dimensionsMaterialsImage:val('dimensionsMaterialsImage'),dimensionsMaterialsAlt:val('dimensionsMaterialsAlt'),relatedProducts:[...control('relatedProducts').selectedOptions].map(o=>o.value) }),
  }));
  [...control('relatedProducts').options].forEach(o=>{o.selected=(content.relatedProducts ?? []).includes(o.value);});
  control('categoryId').addEventListener('change',()=>{
    const select=control('subcategoryId'); select.replaceChildren();
    catalogOptions('subcategories',null,r=>r.categoryId===num('categoryId')).forEach(o=>{const option=el('option','',o.label);option.value=o.value;select.append(option);});
  });
  function refreshPreview() {
    try {
      const c=readFeature(); const slide=featuredFromProduct({id:val('code'),title:val('title'),label:val('label'),desc:val('shortDescription'),photo:val('primaryImageUrl'),photoAlt:val('primaryImageAlt'),featuredConfig:c});
      paintFeatured(desktop,slide);paintFeatured(mobile,slide);
      thumbs.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.templateChoice===c.template)));
    } catch { /* Incomplete input is validated on submit; keep the last good preview. */ }
  }
  fields.oninput=refreshPreview; fields.onchange=refreshPreview; refreshPreview();
};
const editTaxonomy = (resource, item=null) => {
  fields.oninput=null; fields.onchange=null;
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
  ],()=>({value:validateSettings({tabMode:val('tabMode'),autoplayMs:num('autoplayMs'),featuredEnabled:checked('featuredEnabled')}),active:checked('active')}));
};
const setActive=async(resource,item)=>{
  if (!window.confirm(`${item.active?'Desactivar':'Reactivar'} ${item.title??item.name??'configuración'}? No se elimina información.`)) return;
  try { await request(`/api/admin/${resource}/${item.databaseId??item.id}/${item.active?'deactivate':'reactivate'}`,'POST',{version:item.version});await refresh();notify('Estado actualizado.'); }
  catch(e){notify(e.message);}
};
const renderTable=(items,columns,resource)=>{
  if(!items.length)return el('p','admin-empty','No hay registros con este filtro.');
  const wrap=el('div','admin-table-wrap'),table=el('table','admin-table'),head=el('thead'),tr=el('tr'),body=el('tbody');
  columns.forEach(c=>tr.append(el('th','',c[0])));if(resource)tr.append(el('th','','Acciones'));head.append(tr);
  items.forEach(item=>{const row=el('tr');columns.forEach(([,read])=>{const cell=el('td'),value=read(item);value instanceof Node?cell.append(value):cell.textContent=value??'—';row.append(cell);});
    if(resource){const cell=el('td','admin-table__actions');cell.append(button('Editar',()=>resource==='products'?editProduct(item):editTaxonomy(resource,item)),button(item.active?'Desactivar':'Reactivar',()=>setActive(resource,item)));row.append(cell);}body.append(row);});
  table.append(head,body);wrap.append(table);return wrap;
};
const render=()=>{
  workspace.replaceChildren();root.querySelector('[data-admin-title]').textContent=titles[current];
  nav.querySelectorAll('button').forEach(b=>b.classList.toggle('is-active',b.dataset.section===current));
  const toolbar=el('div','admin-section__toolbar');workspace.append(toolbar);
  const resource=current==='featured'?'products':current;
  if(['products','collections','categories','subcategories','featured'].includes(current)){
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
    saving=true;form.querySelector('[data-dialog-submit]').disabled=true;
    const id=editor.record?.databaseId??editor.record?.id;
    await request(`/api/admin/${editor.resource}${id?`/${id}`:''}`,id?'PUT':'POST',{...payload,...(id?{version:editor.record.version}:{})});
    dialog.close();await refresh();notify('Cambios guardados.');
  }catch(e){errorLabel.textContent=e.message;errorLabel.hidden=false;}
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
}finally{root.querySelector('[data-admin-loading]').hidden=true;}
