import { initSiteNavigation } from './site-navigation.js';
import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { getCart, syncCartCount, updateCart } from './cart-store.js';

const DRAFT_KEY = 'sepia-checkout-draft';
const DRAFT_TTL = 1000 * 60 * 60 * 24 * 90;
const state = { entries: [], deliveryPoints: [], whatsappPhone: '', ready: false };

const form = document.querySelector('[data-delivery-form]');
const checkoutButton = document.querySelector('[data-checkout]');
const checkoutStatus = document.querySelector('[data-checkout-status]');
const saveStatus = document.querySelector('[data-save-status]');
const shippingFields = document.querySelector('[data-shipping-fields]');
const pueblaFields = document.querySelector('[data-puebla-fields]');
const pickupList = document.querySelector('[data-pickup-list]');
const pickupLoading = document.querySelector('[data-pickup-loading]');
const pickupEmpty = document.querySelector('[data-pickup-empty]');
const pickupMap = document.querySelector('[data-pickup-map]');
let saveTimer;

const formatPrice = (minor, currency = 'MXN') => `${new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(Number(minor || 0) / 100)} ${currency}`;
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const sameItem = (item, id, variant) => item.id === String(id) && item.variant === (variant == null ? null : String(variant));
const activePromotionPrice = (source, product) => {
  const now = Date.now();
  const active = source === product
    ? product.promotionActive
    : Boolean(source.isPromotion)
      && (!source.promotionStartsAt || Date.parse(source.promotionStartsAt) <= now)
      && (!source.promotionEndsAt || Date.parse(source.promotionEndsAt) > now);
  return active ? source.promotionPriceMinor : null;
};
const changeQuantity = (id, variant, amount) => updateCart(cart => cart.map(item => sameItem(item, id, variant) ? { ...item, quantity: item.quantity + amount } : item).filter(item => item.quantity > 0));
const removeItem = (id, variant) => updateCart(cart => cart.filter(item => !sameItem(item, id, variant)));

const readDraft = () => {
  try {
    const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
    if (!draft || typeof draft !== 'object' || Date.now() - Number(draft.updatedAt || 0) > DRAFT_TTL) return null;
    return draft;
  } catch { return null; }
};

const draftValues = () => ({
  deliveryMethod: new FormData(form).get('deliveryMethod') || 'shipping',
  fullName: form.elements.fullName.value,
  phone: form.elements.phone.value,
  email: form.elements.email.value,
  address: form.elements.address.value,
  pickupPoint: new FormData(form).get('pickupPoint') || '',
  updatedAt: Date.now(),
});

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
  if (!draft) return;
  for (const name of ['fullName', 'phone', 'email', 'address']) {
    if (typeof draft[name] === 'string') form.elements[name].value = draft[name];
  }
  const method = form.querySelector(`[name="deliveryMethod"][value="${draft.deliveryMethod === 'puebla' ? 'puebla' : 'shipping'}"]`);
  if (method) method.checked = true;
};

const selectedMethod = () => new FormData(form).get('deliveryMethod') || 'shipping';
const selectedPoint = () => state.deliveryPoints.find(point => String(point.id) === String(new FormData(form).get('pickupPoint')));

const mapUrls = (point) => {
  const latitude = Number(point.latitude), longitude = Number(point.longitude), delta = 0.006;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const embed = new URL('https://www.openstreetmap.org/export/embed.html');
  embed.searchParams.set('bbox', bbox);
  embed.searchParams.set('layer', 'mapnik');
  embed.searchParams.set('marker', `${latitude},${longitude}`);
  const google = new URL('https://www.google.com/maps/search/');
  google.searchParams.set('api', '1');
  google.searchParams.set('query', `${latitude},${longitude}`);
  return { embed: embed.toString(), google: google.toString() };
};

const paintMap = () => {
  const point = selectedPoint();
  pickupMap.hidden = !point;
  if (!point) return;
  const urls = mapUrls(point);
  pickupMap.querySelector('[data-pickup-map-frame]').src = urls.embed;
  pickupMap.querySelector('[data-pickup-map-name]').textContent = point.name;
  pickupMap.querySelector('[data-pickup-map-link]').href = urls.google;
};

const updateCheckoutState = () => {
  checkoutStatus.hidden = true;
  let blockedMessage = '';
  if (!state.ready) blockedMessage = 'Preparando tu pedido…';
  else if (!state.entries.length) blockedMessage = 'Agrega al menos un producto para continuar.';
  else if (!state.whatsappPhone) blockedMessage = 'La compra por WhatsApp no está disponible por el momento.';
  else if (selectedMethod() === 'puebla' && !state.deliveryPoints.length) blockedMessage = 'No hay puntos de entrega disponibles. Elige envío para continuar.';
  checkoutButton.disabled = Boolean(blockedMessage);
  if (blockedMessage && state.ready && state.entries.length) {
    checkoutStatus.textContent = blockedMessage;
    checkoutStatus.hidden = false;
  }
};

const applyDeliveryMethod = () => {
  const isPuebla = selectedMethod() === 'puebla';
  shippingFields.hidden = isPuebla;
  pueblaFields.hidden = !isPuebla;
  form.elements.address.disabled = isPuebla;
  form.elements.address.required = !isPuebla;
  const pointInputs = [...form.querySelectorAll('[name="pickupPoint"]')];
  pointInputs.forEach((input, index) => {
    input.disabled = !isPuebla;
    input.required = isPuebla && index === 0;
  });
  if (isPuebla) paintMap();
  updateCheckoutState();
};

const renderDeliveryPoints = (restoredPointId = '') => {
  pickupLoading.hidden = true;
  pickupEmpty.hidden = state.deliveryPoints.length > 0;
  pickupList.replaceChildren(...state.deliveryPoints.map((point) => {
    const label = el('label', 'pickup-option');
    const input = el('input');
    const body = el('span', 'pickup-option__body');
    const heading = el('span', 'pickup-option__heading');
    input.type = 'radio'; input.name = 'pickupPoint'; input.value = String(point.id);
    input.checked = String(point.id) === String(restoredPointId);
    heading.append(el('strong', '', point.name), el('span', '', point.schedule));
    body.append(heading);
    if (point.address) body.append(el('small', '', point.address));
    label.append(input, body);
    return label;
  }));
  applyDeliveryMethod();
};

const makeItemRow = ({ product, variant, quantity, unitPrice, currency }, rerender) => {
  const row = el('article', 'cart-item');
  const identity = el('div', 'cart-item__product');
  const image = el('img');
  const copy = el('div', 'cart-item__name');
  const unit = el('strong', 'cart-item__unit', formatPrice(unitPrice, currency));
  const control = el('div', 'cart-qty');
  const decrease = el('button', '', '−');
  const increase = el('button', '', '+');
  const remove = el('button', 'cart-remove');
  image.src = product.photo; image.alt = ''; image.loading = 'lazy';
  image.addEventListener('error', () => {
    image.src = '/assets/sepia-mark-dark.png';
    image.classList.add('is-fallback');
  }, { once: true });
  copy.append(el('strong', '', product.title), el('small', '', variant || product.Collection || 'Pieza SEPIA'));
  decrease.type = increase.type = remove.type = 'button';
  decrease.setAttribute('aria-label', `Restar una unidad de ${product.title}`);
  increase.setAttribute('aria-label', `Agregar una unidad de ${product.title}`);
  remove.setAttribute('aria-label', `Eliminar ${product.title} del carrito`);
  remove.innerHTML = '<i class="bi bi-trash3" aria-hidden="true"></i>';
  decrease.addEventListener('click', () => { changeQuantity(product.id, variant, -1); rerender(); });
  increase.addEventListener('click', () => { changeQuantity(product.id, variant, 1); rerender(); });
  remove.addEventListener('click', () => { removeItem(product.id, variant); rerender(); });
  identity.append(image, copy);
  control.append(decrease, el('span', '', String(quantity)), increase);
  row.append(identity, unit, control, el('strong', 'cart-item__subtotal', formatPrice(unitPrice * quantity, currency)), remove);
  return row;
};

const renderCart = (products) => {
  const itemContainer = document.querySelector('[data-cart-items]');
  const emptyState = document.querySelector('[data-cart-empty]');
  state.entries = getCart().map((item) => {
    const product = products.find(candidate => String(candidate.id) === item.id);
    if (!product) return null;
    const selectedVariant = product.variants?.find(candidate => String(candidate.value) === item.variant);
    const source = selectedVariant ?? product;
    const unitPrice = Number(source.effectivePriceMinor ?? activePromotionPrice(source, product) ?? source.priceMinor ?? product.effectivePriceMinor ?? product.priceMinor ?? 0);
    return { ...item, product, unitPrice, currency: product.currency || 'MXN' };
  }).filter(Boolean);
  itemContainer.replaceChildren(...state.entries.map(entry => makeItemRow(entry, () => renderCart(products))));
  const count = state.entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const subtotal = state.entries.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
  emptyState.hidden = state.entries.length > 0;
  document.querySelector('[data-cart-products]').textContent = `(${count} ${count === 1 ? 'producto' : 'productos'})`;
  document.querySelector('[data-cart-subtotal]').textContent = formatPrice(subtotal);
  document.querySelectorAll('[data-cart-summary]').forEach(element => { element.textContent = formatPrice(subtotal); });
  updateCheckoutState();
};

const orderMessage = () => {
  const data = draftValues();
  const subtotal = state.entries.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
  const productLines = state.entries.map(({ product, variant, quantity, unitPrice, currency }) => {
    const variation = variant ? ` / ${variant}` : '';
    return `• ${product.title}${variation} × ${quantity} — ${formatPrice(unitPrice * quantity, currency)}`;
  });
  const lines = ['Hola, quiero realizar este pedido en SEPIA:', '', ...productLines, '', `Subtotal: ${formatPrice(subtotal)}`, ''];
  if (data.deliveryMethod === 'puebla') {
    const point = selectedPoint();
    const { google } = mapUrls(point);
    lines.push('Entrega: Gratis en Puebla (sábado)', `Punto: ${point.name}`, `Horario: ${point.schedule}`);
    if (point.address) lines.push(`Referencia: ${point.address}`);
    lines.push(`Mapa: ${google}`);
  } else {
    lines.push('Entrega: Envío por coordinar', `Dirección: ${data.address.trim()}`);
  }
  lines.push('', `Nombre: ${data.fullName.trim()}`, `Teléfono: ${data.phone.trim()}`, `Email: ${data.email.trim()}`);
  return lines.join('\n');
};

const initCart = async () => {
  const draft = readDraft();
  restoreDraft(draft);
  applyDeliveryMethod();
  const [productResponse, deliveryResponse] = await Promise.all([fetch('/api/products'), fetch('/api/delivery')]);
  if (!productResponse.ok) throw new Error('No se pudo cargar el catálogo.');
  if (!deliveryResponse.ok) throw new Error('No se pudo cargar la configuración de entrega.');
  const [{ products = [] }, delivery] = await Promise.all([productResponse.json(), deliveryResponse.json()]);
  state.deliveryPoints = Array.isArray(delivery.deliveryPoints) ? delivery.deliveryPoints : [];
  state.whatsappPhone = String(delivery.whatsappPhone || '').replace(/\D/g, '');
  renderDeliveryPoints(draft?.pickupPoint);
  state.ready = true;
  renderCart(products);
};

form.addEventListener('input', () => { saveDraft(); updateCheckoutState(); });
form.addEventListener('change', (event) => {
  if (event.target.name === 'deliveryMethod') applyDeliveryMethod();
  if (event.target.name === 'pickupPoint') paintMap();
  saveDraft();
});
form.addEventListener('submit', (event) => {
  event.preventDefault();
  checkoutStatus.hidden = true;
  if (!state.entries.length || !state.whatsappPhone) { updateCheckoutState(); return; }
  if (selectedMethod() === 'puebla' && !selectedPoint()) {
    checkoutStatus.textContent = 'Selecciona un punto de entrega.';
    checkoutStatus.hidden = false;
    form.querySelector('[name="pickupPoint"]')?.focus();
    return;
  }
  if (!form.reportValidity()) return;
  saveDraft();
  const url = `https://wa.me/${state.whatsappPhone}?text=${encodeURIComponent(orderMessage())}`;
  window.open(url, '_blank', 'noopener,noreferrer');
});

document.querySelector('[data-clear-delivery]').addEventListener('click', () => {
  localStorage.removeItem(DRAFT_KEY);
  form.reset();
  applyDeliveryMethod();
  paintMap();
  announceSaved('Datos eliminados');
});

initSiteNavigation();
syncCartCount();
initCart().catch((error) => {
  document.querySelector('[data-cart-error]').hidden = false;
  document.querySelector('[data-cart-items]').replaceChildren();
  checkoutStatus.textContent = 'No pudimos preparar la compra. Actualiza la página para intentarlo de nuevo.';
  checkoutStatus.hidden = false;
  console.error(error);
});
