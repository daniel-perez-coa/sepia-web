const COOKIE_NAME = 'sepia-cart';
const MAX_ITEMS = 40;
const MAX_QUANTITY = 99;

const normalizeItem = (item) => {
  if (!item || (typeof item.id !== 'string' && typeof item.id !== 'number')) return null;
  return {
    id: String(item.id),
    variant: item.variant == null ? null : String(item.variant),
    quantity: Math.min(MAX_QUANTITY, Math.max(1, Math.trunc(Number(item.quantity) || 1))),
  };
};

export const getCart = () => {
  const encoded = document.cookie.split('; ')
    .find(entry => entry.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(encoded));
    return Array.isArray(parsed) ? parsed.map(normalizeItem).filter(Boolean).slice(0, MAX_ITEMS) : [];
  } catch { return []; }
};

export const syncCartCount = () => {
  const count = getCart().reduce((total, item) => total + item.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach((badge) => {
    badge.textContent = count > 0 ? `(${count})` : '';
    badge.hidden = count === 0;
    badge.setAttribute('aria-label', count > 0 ? `${count} ${count === 1 ? 'producto' : 'productos'} en el carrito` : 'Carrito vacío');
  });
  return count;
};

export const setCart = (items) => {
  const cart = items.map(normalizeItem).filter(Boolean).slice(0, MAX_ITEMS);
  if (!cart.length) {
    document.cookie = `${COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`;
    syncCartCount();
    return [];
  }
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(cart))}; Path=/; SameSite=Lax`;
  syncCartCount();
  return cart;
};

export const updateCart = updater => setCart(updater(getCart()));

export const addCartItem = ({ id, variant = null, quantity = 1 }) => updateCart((cart) => {
  const normalizedId = String(id);
  const normalizedVariant = variant == null ? null : String(variant);
  const existing = cart.find(item => item.id === normalizedId && item.variant === normalizedVariant);
  if (existing) existing.quantity = Math.min(MAX_QUANTITY, existing.quantity + Number(quantity || 1));
  else cart.push({ id: normalizedId, variant: normalizedVariant, quantity });
  return cart;
});
