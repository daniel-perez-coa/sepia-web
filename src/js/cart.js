import { initSiteNavigation } from './site-navigation.js';
import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { getCart, syncCartCount, updateCart } from './cart-store.js';

syncCartCount();

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


const initCart = async () => {
  const itemContainer = document.querySelector('[data-cart-items]');
  const emptyState = document.querySelector('[data-cart-empty]');
  const response = await fetch('/api/products');
  if (!response.ok) throw new Error('No se pudo cargar el catálogo.');
  const { products = [] } = await response.json();
  const render = () => {
    const entries = getCart().map((item) => {
      const product = products.find(candidate => String(candidate.id) === item.id);
      if (!product) return null;
      const selectedVariant = product.variants?.find(candidate => String(candidate.value) === item.variant);
      const source = selectedVariant ?? product;
      const unitPrice = Number(source.effectivePriceMinor ?? activePromotionPrice(source, product) ?? source.priceMinor ?? product.effectivePriceMinor ?? product.priceMinor ?? 0);
      return { ...item, product, unitPrice, currency: product.currency || 'MXN' };
    }).filter(Boolean);
    itemContainer.replaceChildren(...entries.map(entry => makeItemRow(entry, render)));
    const count = entries.reduce((sum, entry) => sum + entry.quantity, 0);
    const subtotal = entries.reduce((sum, entry) => sum + entry.unitPrice * entry.quantity, 0);
    emptyState.hidden = entries.length > 0;
    document.querySelector('[data-cart-products]').textContent = `(${count} ${count === 1 ? 'producto' : 'productos'})`;
    document.querySelector('[data-cart-subtotal]').textContent = formatPrice(subtotal);
    document.querySelectorAll('[data-cart-summary]').forEach(element => { element.textContent = formatPrice(subtotal); });
  };
  render();
};

initSiteNavigation();
initCart().catch((error) => {
  document.querySelector('[data-cart-error]').hidden = false;
  document.querySelector('[data-cart-items]').replaceChildren();
  console.error(error);
});
