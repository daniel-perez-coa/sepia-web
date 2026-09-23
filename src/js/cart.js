import { initSiteNavigation } from './site-navigation.js';
import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { getCart, syncCartCount, updateCart } from './cart-store.js';

const DRAFT_KEY = 'sepia-checkout-draft';
const DRAFT_TTL = 1000 * 60 * 60 * 24 * 90;
const POSTAL_API = 'https://postali.app/api/v1/mx/cp/';
const state = { entries: [], deliveryPoints: [], whatsappPhone: '', ready: false, postalCode: '', postalReady: false, restoredColony: '' };

const form = document.querySelector('[data-delivery-form]');
const checkoutButton = document.querySelector('[data-checkout]');
const checkoutStatus = document.querySelector('[data-checkout-status]');
const deliveryConfirmButton = document.querySelector('[data-delivery-confirm]');
const saveStatus = document.querySelector('[data-save-status]');
const deliveryModal = document.querySelector('[data-delivery-modal]');
const deliverySelector = document.querySelector('[data-delivery-selector]');
const deliverySummary = document.querySelector('[data-delivery-summary]');
const shippingFields = document.querySelector('[data-shipping-fields]');
const pueblaFields = document.querySelector('[data-puebla-fields]');
const pickupList = document.querySelector('[data-pickup-list]');
const pickupLoading = document.querySelector('[data-pickup-loading]');
const pickupEmpty = document.querySelector('[data-pickup-empty]');
const pickupMap = document.querySelector('[data-pickup-map]');
const pickupMapFrame = pickupMap.querySelector('[data-pickup-map-frame]');
const postalStatus = document.querySelector('[data-postal-status]');
const postalLookupButton = document.querySelector('[data-postal-lookup]');
let saveTimer, postalTimer;

const openDeliveryModal = () => {
  if (!deliveryModal.open) deliveryModal.showModal();
};
const closeDeliveryModal = () => {
  if (deliveryModal.open) deliveryModal.close();
};

const formatPrice = (minor, currency = 'MXN') => `${new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(Number(minor || 0) / 100)} ${currency}`;
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const sameItem = (item, id, variant) => item.id === String(id) && item.variant === (variant == null ? null : String(variant));
const activePromotionPrice = (source, product) => {
  const now = Date.now();
  const active = source === product ? product.promotionActive : Boolean(source.isPromotion)
    && (!source.promotionStartsAt || Date.parse(source.promotionStartsAt) <= now)
    && (!source.promotionEndsAt || Date.parse(source.promotionEndsAt) > now);
  return active ? source.promotionPriceMinor : null;
};
const changeQuantity = (id, variant, amount) => updateCart(cart => cart.map(item => sameItem(item, id, variant) ? { ...item, quantity: item.quantity + amount } : item).filter(item => item.quantity > 0));
const removeItem = (id, variant) => updateCart(cart => cart.filter(item => !sameItem(item, id, variant)));

const readDraft = () => {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return draft && typeof draft === 'object' && Date.now() - Number(draft.updatedAt || 0) <= DRAFT_TTL ? draft : null;
  } catch { return null; }
};
const normalizeContactField = (control) => {
  const clean = control.name === 'fullName'
    ? value => value.replace(/\p{N}/gu, '')
    : value => value.replace(/[^0-9]/g, '').slice(0, 10);
  const previous = control.value, start = control.selectionStart, end = control.selectionEnd;
  const normalized = clean(previous);
  if (normalized !== previous) {
    control.value = normalized;
    if (document.activeElement === control && start !== null && end !== null) {
      control.setSelectionRange(clean(previous.slice(0, start)).length, clean(previous.slice(0, end)).length);
    }
  }
  if (control.name === 'fullName') control.setCustomValidity(control.value.trim() && /\p{L}/u.test(control.value) ? '' : 'Escribe tu nombre completo con letras.');
  else control.setCustomValidity(!control.value || /^[0-9]{10}$/.test(control.value) ? '' : 'Escribe exactamente 10 dígitos de México.');
};
const draftValues = () => Object.fromEntries([
  'fullName', 'phone', 'email', 'postalCode', 'colony', 'street', 'exteriorNumber', 'interiorNumber', 'municipality', 'state', 'crossStreets', 'references',
].map(name => [name, form.elements[name]?.value ?? '']).concat([
  ['deliveryMethod', new FormData(form).get('deliveryMethod') || ''],
  ['pickupPoint', new FormData(form).get('pickupPoint') || ''],
  ['updatedAt', Date.now()],
]));
const announceSaved = (message = 'Guardado') => {
  saveStatus.textContent = message;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => { saveStatus.textContent = ''; }, 2400);
};
const saveDraft = () => {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(draftValues())); announceSaved(); }
  catch { saveStatus.textContent = 'No se pudo guardar'; }
};
const restoreDraft = (draft) => {
  document.querySelectorAll('[name="deliveryMethod"]').forEach(method => { method.checked = false; });
  if (!draft) return;
  for (const name of ['fullName', 'phone', 'email', 'postalCode', 'street', 'exteriorNumber', 'interiorNumber', 'municipality', 'state', 'crossStreets', 'references']) {
    if (typeof draft[name] === 'string' && form.elements[name]) form.elements[name].value = draft[name];
  }
  normalizeContactField(form.elements.fullName);
  normalizeContactField(form.elements.phone);
  state.restoredColony = typeof draft.colony === 'string' ? draft.colony : '';
  const hasShippingData = ['fullName', 'phone', 'postalCode', 'colony', 'street', 'exteriorNumber', 'municipality', 'state'].every(name => String(draft[name] || '').trim());
  const hasPueblaData = ['fullName', 'phone', 'pickupPoint'].every(name => String(draft[name] || '').trim());
  const methodValue = draft.deliveryMethod === 'puebla' && hasPueblaData ? 'puebla' : draft.deliveryMethod === 'shipping' && hasShippingData ? 'shipping' : '';
  if (!methodValue) return;
  const method = document.querySelector(`[name="deliveryMethod"][value="${methodValue}"]`);
  if (method) method.checked = true;
};

const selectedMethod = () => new FormData(form).get('deliveryMethod') || '';
const selectedPoint = () => state.deliveryPoints.find(point => String(point.id) === String(new FormData(form).get('pickupPoint')));
const selectedText = (name, fallback = '') => form.elements[name]?.value.trim() || fallback;
const contactDetailsValid = () => {
  const name = selectedText('fullName'), phone = selectedText('phone');
  return /\p{L}/u.test(name) && !/\p{N}/u.test(name) && /^[0-9]{10}$/.test(phone);
};

const mapUrls = (point) => {
  const latitude = Number(point.latitude), longitude = Number(point.longitude), delta = 0.006;
  const embed = new URL('https://www.openstreetmap.org/export/embed.html');
  embed.searchParams.set('bbox', `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`);
  embed.searchParams.set('layer', 'mapnik'); embed.searchParams.set('marker', `${latitude},${longitude}`);
  const google = new URL('https://www.google.com/maps/search/');
  google.searchParams.set('api', '1'); google.searchParams.set('query', `${latitude},${longitude}`);
  return { embed: embed.toString(), google: google.toString() };
};
const paintMap = () => {
  const point = selectedPoint(); pickupMap.hidden = !point;
  if (!point) return;
  const urls = mapUrls(point);
  pickupMapFrame.src = urls.embed;
  pickupMap.querySelector('[data-pickup-map-name]').textContent = point.name;
  pickupMap.querySelector('[data-pickup-map-link]').href = urls.google;
};
pickupMap.querySelector('[data-pickup-map-center]').addEventListener('click', () => {
  const point = selectedPoint();
  if (point) pickupMapFrame.src = mapUrls(point).embed;
});

const resetPostalResult = (message = '') => {
  state.postalReady = false;
  const colony = form.elements.colony;
  colony.replaceChildren(new Option('Seleccionar colonia', ''));
  colony.disabled = true;
  postalStatus.textContent = message;
};
const setStateValue = (value) => {
  const stateField = form.elements.state;
  const match = [...stateField.options].find(option => option.value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase() === String(value).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase());
  stateField.value = match?.value ?? '';
};
const lookupPostalCode = async () => {
  const code = form.elements.postalCode.value.replace(/\D/g, '').slice(0, 5);
  form.elements.postalCode.value = code;
  if (!/^\d{5}$/.test(code)) { resetPostalResult('Escribe los 5 dígitos del código postal.'); updateCheckoutState(); return; }
  if (code === state.postalCode && state.postalReady) return;
  state.postalCode = code; state.postalReady = false;
  postalStatus.textContent = 'Consultando código postal…'; postalLookupButton.disabled = true;
  form.elements.colony.disabled = true;
  try {
    const response = await fetch(`${POSTAL_API}${encodeURIComponent(code)}`);
    if (!response.ok) throw new Error('Código postal no encontrado.');
    const data = await response.json();
    const colonies = [...new Set((data.asentamientos || []).map(item => String(item.nombre || '').trim()).filter(Boolean))];
    if (!data.estado || !data.municipio || !colonies.length) throw new Error('No encontramos datos completos para este código postal.');
    form.elements.colony.replaceChildren(new Option('Seleccionar colonia', ''), ...colonies.map(name => new Option(name, name)));
    form.elements.colony.disabled = selectedMethod() === 'puebla';
    form.elements.colony.value = colonies.includes(state.restoredColony) ? state.restoredColony : '';
    state.restoredColony = '';
    form.elements.municipality.value = data.municipio;
    setStateValue(data.estado);
    state.postalReady = true;
    postalStatus.textContent = `${colonies.length} ${colonies.length === 1 ? 'colonia encontrada' : 'colonias encontradas'}.`;
  } catch (error) {
    resetPostalResult(error.message || 'No pudimos consultar este código postal.');
  } finally {
    postalLookupButton.disabled = false;
    updateCheckoutState(); saveDraft();
  }
};

const updateDeliverySummary = () => {
  const method = selectedMethod();
  const complete = method === 'puebla'
    ? Boolean(selectedPoint() && contactDetailsValid() && form.checkValidity())
    : method === 'shipping' && Boolean(contactDetailsValid() && state.postalReady && form.checkValidity());
  deliverySummary.textContent = complete ? (method === 'puebla' ? 'Selecciona tu envío' : 'Envío · listo') : 'Completar';
  deliveryConfirmButton.disabled = !complete;
};
const updateCheckoutState = () => {
  checkoutStatus.hidden = true;
  let blockedMessage = '';
  if (!state.ready) blockedMessage = 'Preparando tu pedido…';
  else if (!state.entries.length) blockedMessage = 'Agrega al menos un producto para continuar.';
  else if (!state.whatsappPhone) blockedMessage = 'La compra por WhatsApp no está disponible por el momento.';
  else if (!selectedMethod()) blockedMessage = 'Elige cómo recibes tu pedido.';
  else if (!contactDetailsValid()) blockedMessage = 'Escribe tu nombre sin números y un teléfono mexicano de 10 dígitos.';
  else if (selectedMethod() === 'puebla' && !state.deliveryPoints.length) blockedMessage = 'No hay puntos de entrega disponibles. Elige envío para continuar.';
  else if (selectedMethod() === 'puebla' && !selectedPoint()) blockedMessage = 'Selecciona un lugar de entrega.';
  else if (selectedMethod() === 'shipping' && !state.postalReady) blockedMessage = 'Consulta y completa la dirección de envío.';
  else if (!form.checkValidity()) blockedMessage = 'Completa los datos obligatorios de entrega.';
  checkoutButton.disabled = Boolean(blockedMessage);
  if (blockedMessage && state.ready && state.entries.length) { checkoutStatus.textContent = blockedMessage; checkoutStatus.hidden = false; }
  updateDeliverySummary();
};
const applyDeliveryMethod = () => {
  const isPuebla = selectedMethod() === 'puebla';
  shippingFields.hidden = isPuebla; pueblaFields.hidden = !isPuebla;
  shippingFields.querySelectorAll('input, select, textarea, button').forEach(control => { control.disabled = isPuebla; });
  if (!isPuebla) {
    postalLookupButton.disabled = false;
    form.elements.colony.disabled = !state.postalReady;
  }
  [...form.querySelectorAll('[name="pickupPoint"]')].forEach((input, index) => { input.disabled = !isPuebla; input.required = isPuebla && index === 0; });
  if (isPuebla) paintMap();
  updateCheckoutState();
};
const renderDeliveryPoints = (restoredPointId = '') => {
  pickupLoading.hidden = true; pickupEmpty.hidden = state.deliveryPoints.length > 0;
  pickupList.replaceChildren(...state.deliveryPoints.map((point) => {
    const label = el('label', 'pickup-option'), input = el('input'), body = el('span', 'pickup-option__body'), heading = el('span', 'pickup-option__heading');
    input.type = 'radio'; input.name = 'pickupPoint'; input.value = String(point.id); input.checked = String(point.id) === String(restoredPointId);
    heading.append(el('strong', '', point.name), el('span', '', point.schedule)); body.append(heading);
    if (point.address) body.append(el('small', '', point.address));
    if (point.instructions) body.append(el('small', '', `Instrucciones: ${point.instructions}`));
    label.append(input, body); return label;
  }));
  applyDeliveryMethod();
};

const makeItemRow = ({ product, variant, quantity, unitPrice, currency }, rerender) => {
  const row = el('article', 'cart-item'), identity = el('div', 'cart-item__product'), image = el('img'), copy = el('div', 'cart-item__name');
  const unit = el('strong', 'cart-item__unit', formatPrice(unitPrice, currency)), control = el('div', 'cart-qty'), decrease = el('button', '', '−'), increase = el('button', '', '+'), remove = el('button', 'cart-remove');
  image.src = product.photo; image.alt = ''; image.loading = 'lazy';
  image.addEventListener('error', () => { image.src = '/assets/sepia-mark-dark.png'; image.classList.add('is-fallback'); }, { once: true });
  copy.append(el('strong', '', product.title), el('small', '', variant || product.Collection || 'Pieza SEPIA'));
  decrease.type = increase.type = remove.type = 'button';
  decrease.setAttribute('aria-label', `Restar una unidad de ${product.title}`); increase.setAttribute('aria-label', `Agregar una unidad de ${product.title}`); remove.setAttribute('aria-label', `Eliminar ${product.title} del carrito`);
  remove.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
  decrease.addEventListener('click', () => { changeQuantity(product.id, variant, -1); rerender(); }); increase.addEventListener('click', () => { changeQuantity(product.id, variant, 1); rerender(); }); remove.addEventListener('click', () => { removeItem(product.id, variant); rerender(); });
  identity.append(image, copy); control.append(decrease, el('span', '', String(quantity)), increase);
  row.append(identity, unit, control, el('strong', 'cart-item__subtotal', formatPrice(unitPrice * quantity, currency)), remove); return row;
};
const renderCart = (products) => {
  const itemContainer = document.querySelector('[data-cart-items]'), emptyState = document.querySelector('[data-cart-empty]');
  state.entries = getCart().map(item => {
    const product = products.find(candidate => String(candidate.id) === item.id); if (!product) return null;
    const selectedVariant = product.variants?.find(candidate => String(candidate.value) === item.variant), source = selectedVariant ?? product;
    const unitPrice = Number(source.effectivePriceMinor ?? activePromotionPrice(source, product) ?? source.priceMinor ?? product.effectivePriceMinor ?? product.priceMinor ?? 0);
    return { ...item, product, unitPrice, currency: product.currency || 'MXN' };
  }).filter(Boolean);
  itemContainer.replaceChildren(...state.entries.map(entry => makeItemRow(entry, () => renderCart(products))));
  const count = state.entries.reduce((sum, entry) => sum + entry.quantity, 0), subtotal = state.entries.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
  emptyState.hidden = state.entries.length > 0; document.querySelector('[data-cart-products]').textContent = `(${count} ${count === 1 ? 'producto' : 'productos'})`;
  document.querySelector('[data-cart-subtotal]').textContent = formatPrice(subtotal); document.querySelectorAll('[data-cart-summary]').forEach(element => { element.textContent = formatPrice(subtotal); }); updateCheckoutState();
};
const orderMessage = () => {
  const data = draftValues(), subtotal = state.entries.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
  const products = state.entries.map(({ product, variant, quantity, unitPrice, currency }) => `• ${product.title}${variant ? ` / ${variant}` : ''} × ${quantity} — ${formatPrice(unitPrice * quantity, currency)}`);
  const lines = ['Hola, quiero realizar este pedido en SEPIA:', '', ...products, '', `Subtotal: ${formatPrice(subtotal)}`, ''];
  if (data.deliveryMethod === 'puebla') {
    const point = selectedPoint(), { google } = mapUrls(point);
    lines.push('Entrega: Gratis en Puebla (sábado)', `Punto: ${point.name}`, `Horario: ${point.schedule}`); if (point.address) lines.push(`Dirección: ${point.address}`); if (point.instructions) lines.push(`Instrucciones de entrega: ${point.instructions}`); lines.push(`Mapa: ${google}`);
  } else {
    lines.push('Entrega: Envío por coordinar', `Destinatario: ${data.fullName}`, `Dirección: ${data.street} ${data.exteriorNumber}${data.interiorNumber ? `, Int. ${data.interiorNumber}` : ''}`, `Colonia: ${data.colony}`, `C.P.: ${data.postalCode}`, `Municipio / Alcaldía: ${data.municipality}`, `Estado: ${data.state}`, ...(data.crossStreets ? [`Entre calles: ${data.crossStreets}`] : []), ...(data.references ? [`Referencias: ${data.references}`] : []));
  }
  lines.push('', `Teléfono / WhatsApp: ${data.phone}`, ...(data.email ? [`Email: ${data.email}`] : [])); return lines.join('\n');
};
const initCart = async () => {
  const draft = readDraft(); restoreDraft(draft); applyDeliveryMethod();
  const [productResponse, deliveryResponse] = await Promise.all([fetch('/api/products'), fetch('/api/delivery')]);
  if (!productResponse.ok || !deliveryResponse.ok) throw new Error('No se pudo cargar la información del pedido.');
  const [{ products = [] }, delivery] = await Promise.all([productResponse.json(), deliveryResponse.json()]);
  state.deliveryPoints = Array.isArray(delivery.deliveryPoints) ? delivery.deliveryPoints : []; state.whatsappPhone = String(delivery.whatsappPhone || '').replace(/\D/g, '');
  renderDeliveryPoints(draft?.pickupPoint); state.ready = true; renderCart(products);
  if (selectedMethod() === 'shipping' && /^\d{5}$/.test(form.elements.postalCode.value)) lookupPostalCode();
};

form.addEventListener('input', event => {
  if (event.target.name === 'fullName' || event.target.name === 'phone') normalizeContactField(event.target);
  if (event.target.name === 'postalCode') { form.elements.municipality.value = ''; form.elements.state.value = ''; clearTimeout(postalTimer); state.postalReady = false; state.postalCode = ''; resetPostalResult(''); postalTimer = window.setTimeout(lookupPostalCode, 450); }
  saveDraft(); updateCheckoutState();
});
deliverySelector.addEventListener('click', event => {
  const method = event.target.closest('.delivery-method');
  if (!method) return;
  event.preventDefault();
  const input = method.querySelector('[name="deliveryMethod"]');
  input.checked = true; input.focus(); applyDeliveryMethod(); saveDraft(); openDeliveryModal();
});
deliverySelector.addEventListener('change', event => {
  if (event.target.name === 'deliveryMethod') { applyDeliveryMethod(); saveDraft(); openDeliveryModal(); }
});
form.addEventListener('change', event => { if (event.target.name === 'pickupPoint') paintMap(); saveDraft(); updateCheckoutState(); });
postalLookupButton.addEventListener('click', lookupPostalCode);
form.addEventListener('submit', event => {
  event.preventDefault(); checkoutStatus.hidden = true;
  if (checkoutButton.disabled) { updateCheckoutState(); openDeliveryModal(); return; }
  if (!form.reportValidity()) { openDeliveryModal(); form.reportValidity(); return; }
  saveDraft(); window.open(`https://wa.me/${state.whatsappPhone}?text=${encodeURIComponent(orderMessage())}`, '_blank', 'noopener,noreferrer');
});
document.querySelectorAll('[data-close-delivery-modal]').forEach(button => button.addEventListener('click', () => { saveDraft(); closeDeliveryModal(); }));
initSiteNavigation(); syncCartCount();
initCart().catch(error => { document.querySelector('[data-cart-error]').hidden = false; document.querySelector('[data-cart-items]').replaceChildren(); checkoutStatus.textContent = 'No pudimos preparar la compra. Actualiza la página para intentarlo de nuevo.'; checkoutStatus.hidden = false; console.error(error); });
