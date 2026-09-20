export const normalizeExploreText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const getExplorePrice = (product = {}) => {
  const minor = Number(product.effectivePriceMinor ?? product.priceMinor);
  if (Number.isFinite(minor)) return minor / 100;

  const rawPrice = String(product.price ?? '').trim();
  const match = rawPrice.match(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+/);
  if (!match) return 0;

  const numeric = match[0].replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
  return Number(numeric) || 0;
};

const hasColorLabel = (value) => normalizeExploreText(value) === 'color';

export const getProductColors = (product = {}) => {
  const optionColors = Array.isArray(product.options)
    ? product.options
      .filter((option) => hasColorLabel(option?.label))
      .flatMap((option) => Array.isArray(option.values) ? option.values : [])
    : [];
  const variantColors = hasColorLabel(product.variantLabel) && Array.isArray(product.variants)
    ? product.variants.map((variant) => variant?.value)
    : [];

  return [...optionColors, ...variantColors]
    .map(normalizeExploreText)
    .filter(Boolean);
};

const getProductStock = (product = {}) => {
  if (product.stock === null || product.stock === undefined || product.stock === '') return null;
  const stock = Number(product.stock);
  return Number.isFinite(stock) ? stock : null;
};

const matchesColor = (product, color) => {
  if (color === '*') return true;
  const selectedColor = normalizeExploreText(color);
  return getProductColors(product).some((value) => value === selectedColor || value.startsWith(`${selectedColor} `));
};

const matchesAvailability = (product, availability) => {
  if (availability === '*') return true;
  const stock = getProductStock(product);
  if (availability === 'available') return stock === null || stock > 5;
  if (availability === 'low') return stock !== null && stock > 0 && stock <= 5;
  if (availability === 'sold-out') return stock !== null && stock <= 0;
  return true;
};

const matchesPrice = (product, price) => {
  const value = getExplorePrice(product);
  if (price === 'under-600') return value < 600;
  if (price === '600-999') return value >= 600 && value < 1000;
  if (price === 'over-1000') return value >= 1000;
  return true;
};

export const productMatchesExploreFilters = (product, filters = {}) => {
  const { color = '*', series = '*', availability = '*', price = '*' } = filters;
  const matchesSeries = series === '*' || normalizeExploreText(product.label) === normalizeExploreText(series);
  return matchesColor(product, color)
    && matchesSeries
    && matchesAvailability(product, availability)
    && matchesPrice(product, price);
};
