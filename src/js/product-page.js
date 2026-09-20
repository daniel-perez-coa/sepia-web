import { initSiteNavigation } from './site-navigation.js';
import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { addCartItem, syncCartCount } from './cart-store.js';

syncCartCount();

const createIcon = (name) => {
  const icon = document.createElement('i');
  icon.className = `bi bi-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

const formatPrice = (minor, currency = 'MXN') => `${new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format(minor / 100)} ${currency}`;

const appendFactRows = (container, rows = []) => {
  const list = document.createElement('dl');
  rows.forEach(({ label, value }) => {
    const term = document.createElement('dt');
    const description = document.createElement('dd');
    term.textContent = label;
    description.textContent = value;
    list.append(term, description);
  });
  container.append(list);
};



const renderProduct = (root, product, products) => {
  const mainImage = root.querySelector('[data-detail-main-image]');
  const tagBadge = root.querySelector('[data-detail-tag]');
  const dimensionsImage = root.querySelector('[data-detail-dimensions-image]');
  const thumbnails = root.querySelector('[data-detail-thumbnails]');
  const promotionLabel = root.querySelector('[data-detail-promotion-label]');
  const promotionBadge = root.querySelector('[data-detail-promotion]');
  const regularPrice = root.querySelector('[data-detail-regular-price]');
  const countdown = root.querySelector('[data-detail-countdown]');
  const countdownValue = root.querySelector('[data-detail-countdown-value]');
  const options = root.querySelector('[data-detail-options]');
  const includes = root.querySelector('[data-detail-includes]');
  const excludesSection = root.querySelector('[data-detail-excludes-section]');
  const excludes = root.querySelector('[data-detail-excludes]');
  const facts = root.querySelector('[data-detail-facts]');
  const related = root.querySelector('[data-detail-related]');
  const relatedSection = root.querySelector('[data-detail-related-section]');
  const relatedPrevious = root.querySelector('[data-detail-related-previous]');
  const relatedNext = root.querySelector('[data-detail-related-next]');
  const dimensionsFallback = root.querySelector('[data-detail-dimensions-fallback]');
  const dimensionsSection = dimensionsFallback.closest('.product-detail__dimensions');
  const contentGrid = dimensionsSection.closest('.product-detail__content-grid');
  const quantityOutput = root.querySelector('[data-detail-quantity]');
  const cartButton = root.querySelector('[data-detail-cart]');
  const previousButton = root.querySelector('[data-detail-previous]');
  const nextButton = root.querySelector('[data-detail-next]');
  const gallery = product.gallery?.length
    ? product.gallery
    : [{ src: product.photo, alt: product.desc }];
  let activeGalleryIndex = 0;
  let quantity = 1;
  let maxQuantity = product.stock === null ? 99 : Math.max(0, product.stock);
  let selectedVariant = product.variants?.[0] ?? null;

  root.querySelectorAll('[data-detail-collection]').forEach((element) => {
    element.textContent = product.Collection;
  });
  root.querySelector('[data-detail-breadcrumb]').textContent = product.title;
  root.querySelector('[data-detail-title]').textContent = product.title;
  const productTag = product.tags?.find(tag => tag.active) ?? product.tags?.[0];
  tagBadge.hidden = !productTag;
  tagBadge.textContent = productTag?.name ?? '';
  let countdownTimer;
  const promotionIsActive = item => Boolean(item.isPromotion)
    && (!item.promotionStartsAt || Date.parse(item.promotionStartsAt) <= Date.now())
    && (!item.promotionEndsAt || Date.parse(item.promotionEndsAt) > Date.now())
    && item.promotionPriceMinor !== null && item.promotionPriceMinor !== undefined
    && item.promotionPriceMinor < item.priceMinor;
  const updateCountdown = (hasPromotion, endValue) => {
    const end = Date.parse(endValue || '');
    const remaining = end - Date.now();
    if (!hasPromotion || !Number.isFinite(end) || remaining <= 0) {
      countdown.hidden = true;
      if (countdownTimer) window.clearInterval(countdownTimer);
      return;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    countdown.hidden = false;
    countdownValue.textContent = `${days ? `${days}D ` : ''}${String(hours).padStart(2, '0')}H ${String(minutes).padStart(2, '0')}M ${String(seconds).padStart(2, '0')}S`;
  };
  const updatePurchase = variant => {
    selectedVariant = variant;
    const source = variant ?? product;
    const hasPromotion = variant ? promotionIsActive(variant) : Boolean(product.promotionActive && product.effectivePriceMinor < product.priceMinor);
    const normalPrice = Number(source.priceMinor);
    const effectivePrice = hasPromotion ? Number(source.promotionPriceMinor ?? product.effectivePriceMinor) : normalPrice;
    const discountPercentage = hasPromotion ? Math.round((1 - (effectivePrice / normalPrice)) * 100) : 0;
    root.querySelector('[data-detail-price]').textContent = Number.isFinite(effectivePrice) ? formatPrice(effectivePrice, product.currency) : 'PRECIO BAJO PEDIDO';
    promotionLabel.hidden = !hasPromotion;
    promotionLabel.textContent = hasPromotion ? (source.promotionLabel || product.promotionLabel || 'PROMOCIÓN') : '';
    promotionBadge.hidden = !hasPromotion;
    promotionBadge.textContent = hasPromotion ? `${discountPercentage}% OFF` : '';
    regularPrice.hidden = !hasPromotion;
    regularPrice.textContent = hasPromotion ? formatPrice(normalPrice, product.currency) : '';
    regularPrice.setAttribute('aria-label', hasPromotion ? `Precio anterior: ${formatPrice(normalPrice, product.currency)}` : '');
    maxQuantity = source.stock === null || source.stock === undefined ? 99 : Math.max(0, source.stock);
    root.querySelector('[data-detail-stock]').textContent = source.stock === null || source.stock === undefined ? 'SOBRE PEDIDO' : `${source.stock} DISPONIBLES`;
    if (quantity > Math.max(1, maxQuantity)) {
      quantity = Math.max(1, maxQuantity);
      quantityOutput.value = String(quantity);
      quantityOutput.textContent = String(quantity);
    }
    if (countdownTimer) window.clearInterval(countdownTimer);
    updateCountdown(hasPromotion, source.promotionEndsAt);
    if (!countdown.hidden) countdownTimer = window.setInterval(() => updateCountdown(hasPromotion, source.promotionEndsAt), 1000);
  };
  updatePurchase(selectedVariant);
  root.querySelector('[data-detail-description]').textContent = product.desc || product.longDescription;
  root.querySelector('[data-detail-full-title]').textContent = product.title;
  root.querySelector('[data-detail-full-description]').textContent = product.longDescription || product.desc;
  root.querySelector('[data-detail-email]').href = `mailto:hola@sepia.mx?subject=${encodeURIComponent(`Solicitud de mayoreo: ${product.title}`)}`;
  document.title = `${product.title} | SEPIA`;

  const optionGroups = [];
  if (product.variants?.length) optionGroups.push({
    label: product.variantLabel || 'OPCIÓN',
    values: product.variants.map(variant => variant.value),
    selected: 0,
    variants: product.variants,
  });
  optionGroups.push(...(product.options || []).filter(group => !product.variants?.length || group.label !== product.variantLabel));
  options.replaceChildren(...optionGroups.map((group) => {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    const choices = document.createElement('div');
    legend.textContent = group.label;
    choices.className = 'product-detail__choices';

    group.values.forEach((value, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = value;
      button.classList.toggle('is-active', index === (group.selected ?? 0));
      button.setAttribute('aria-pressed', String(index === (group.selected ?? 0)));
      button.addEventListener('click', () => {
        [...choices.children].forEach((choice) => {
          const isActive = choice === button;
          choice.classList.toggle('is-active', isActive);
          choice.setAttribute('aria-pressed', String(isActive));
        });
        if (group.variants) updatePurchase(group.variants[index]);
      });
      choices.append(button);
    });

    fieldset.append(legend, choices);
    return fieldset;
  }));

  includes.replaceChildren(...(product.includes || []).map((item) => {
    const listItem = document.createElement('li');
    listItem.append(createIcon(item.icon || 'check2-circle'), document.createTextNode(item.text));
    return listItem;
  }));

  const specificationValue = pattern => product.specifications?.find(item => pattern.test(item.label))?.value ?? '';
  const storedDimensions = Array.isArray(product.dimensions) ? product.dimensions : Object.entries(product.dimensions ?? {}).map(([key, value]) => ({ icon: key === 'height' ? 'arrows-vertical' : key === 'width' ? 'arrows' : 'box', title: key === 'height' ? 'Alto' : key === 'width' ? 'Ancho' : 'Profundidad', value }));
  const dimensions = storedDimensions.length
    ? storedDimensions.filter(dimension => dimension.title?.trim() && dimension.value?.trim())
    : [
      { icon: 'arrows-vertical', title: 'Alto', value: specificationValue(/alto|altura/i) },
      { icon: 'arrows', title: 'Ancho', value: specificationValue(/ancho/i) },
      { icon: 'box', title: 'Profundidad', value: specificationValue(/profundidad|fondo/i) },
    ].filter(dimension => dimension.value);
  dimensionsFallback.replaceChildren(...dimensions.map(dimension => {
    const item = document.createElement('span');
    const copy = document.createElement('span');
    const label = document.createElement('small');
    const value = document.createElement('strong');
    label.textContent = dimension.title;
    value.textContent = dimension.value;
    copy.append(label, value);
    item.append(createIcon(dimension.icon), copy);
    return item;
  }));
  excludes.replaceChildren(...(product.excludes || []).map((item) => {
    const listItem = document.createElement('li');
    listItem.append(createIcon(item.icon || 'x-circle'), document.createTextNode(item.text));
    return listItem;
  }));
  excludesSection.hidden = !(product.excludes || []).length;
  const showDimensionFallback = () => {
    dimensionsImage.hidden = true;
    const hasDimensions = dimensions.length > 0;
    dimensionsFallback.hidden = !hasDimensions;
    dimensionsSection.hidden = !hasDimensions;
    contentGrid.classList.toggle('is-without-dimensions', !hasDimensions);
  };
  if (product.dimensionsMaterialsImage) {
    dimensionsSection.hidden = false;
    contentGrid.classList.remove('is-without-dimensions');
    dimensionsImage.src = product.dimensionsMaterialsImage;
    dimensionsImage.alt = `Dimensiones y materiales de ${product.title}`;
    dimensionsImage.hidden = false;
    dimensionsFallback.hidden = true;
    dimensionsImage.addEventListener('error', showDimensionFallback, { once: true });
  } else showDimensionFallback();

  const renderGalleryImage = (index) => {
    activeGalleryIndex = (index + gallery.length) % gallery.length;
    const selectedImage = gallery[activeGalleryIndex];
    mainImage.src = selectedImage.src;
    mainImage.alt = selectedImage.alt || `${product.title}, vista ${activeGalleryIndex + 1}`;
    [...thumbnails.children].forEach((button, buttonIndex) => {
      const isActive = buttonIndex === activeGalleryIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  };

  thumbnails.replaceChildren(...gallery.map((image, index) => {
    const button = document.createElement('button');
    const thumbnail = document.createElement('img');
    button.type = 'button';
    button.setAttribute('aria-label', `Mostrar vista ${index + 1} de ${product.title}`);
    thumbnail.src = image.src;
    thumbnail.alt = '';
    button.append(thumbnail);
    button.addEventListener('click', () => renderGalleryImage(index));
    return button;
  }));
  previousButton.hidden = gallery.length < 2;
  nextButton.hidden = gallery.length < 2;
  previousButton.addEventListener('click', () => renderGalleryImage(activeGalleryIndex - 1));
  nextButton.addEventListener('click', () => renderGalleryImage(activeGalleryIndex + 1));
  renderGalleryImage(0);

  facts.replaceChildren(...[
    ['ESPECIFICACIONES', product.specifications],
  ].filter(([, rows]) => Array.isArray(rows) && rows.length).map(([title, rows], index) => {
    const disclosure = document.createElement('details');
    const summary = document.createElement('summary');
    const content = document.createElement('div');
    summary.append(document.createTextNode(title), createIcon(index === 0 ? 'dash-lg' : 'plus-lg'));
    appendFactRows(content, rows);
    disclosure.open = index === 0;
    disclosure.addEventListener('toggle', () => {
      summary.querySelector('i').className = `bi bi-${disclosure.open ? 'dash-lg' : 'plus-lg'}`;
    });
    disclosure.append(summary, content);
    return disclosure;
  }));

  const productTagIds = new Set((product.tags ?? []).filter(tag => tag.active).map(tag => tag.id));
  const relatedProducts = products
    .filter(candidate => candidate.id !== product.id)
    .map(candidate => {
      const sharedTags = (candidate.tags ?? []).filter(tag => tag.active && productTagIds.has(tag.id)).length;
      const sameSubcategory = product.subcategoryId && candidate.subcategoryId === product.subcategoryId;
      const sameCategory = candidate.categoryId === product.categoryId;
      return { product: candidate, score: sharedTags * 100 + Number(sameSubcategory) * 20 + Number(sameCategory) * 10 };
    })
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score || a.product.sortOrder - b.product.sortOrder)
    .map(candidate => candidate.product);
  relatedSection.hidden = relatedProducts.length === 0;
  related.replaceChildren(...relatedProducts.map((relatedProduct) => {
      const link = document.createElement('a');
      const image = document.createElement('img');
      const copy = document.createElement('span');
      const title = document.createElement('strong');
      const collection = document.createElement('small');
      link.href = `/producto?id=${encodeURIComponent(relatedProduct.id)}`;
      link.setAttribute('aria-label', `Ver información de ${relatedProduct.title}`);
      image.src = relatedProduct.photo;
      image.alt = '';
      title.textContent = relatedProduct.title;
      collection.textContent = relatedProduct.Collection;
      copy.append(title, collection);
      link.append(image, copy, createIcon('arrow-up-right'));
      return link;
    }));
  const updateRelatedControls = () => {
    relatedPrevious.disabled = related.scrollLeft <= 2;
    relatedNext.disabled = related.scrollLeft + related.clientWidth >= related.scrollWidth - 2;
  };
  relatedPrevious.addEventListener('click', () => related.scrollBy({ left: -related.clientWidth * 0.8, behavior: 'smooth' }));
  relatedNext.addEventListener('click', () => related.scrollBy({ left: related.clientWidth * 0.8, behavior: 'smooth' }));
  related.addEventListener('scroll', updateRelatedControls, { passive: true });
  requestAnimationFrame(updateRelatedControls);

  root.querySelector('[data-detail-decrease]').addEventListener('click', () => {
    quantity = Math.max(1, quantity - 1);
    quantityOutput.value = String(quantity);
    quantityOutput.textContent = String(quantity);
  });
  root.querySelector('[data-detail-increase]').addEventListener('click', () => {
    if (maxQuantity === 0) return;
    quantity = Math.min(maxQuantity, quantity + 1);
    quantityOutput.value = String(quantity);
    quantityOutput.textContent = String(quantity);
  });

  const addCurrentSelection = () => {
    const variantValue = selectedVariant?.value ?? null;
    addCartItem({ id: product.id, variant: variantValue, quantity });
  };

  cartButton.addEventListener('click', () => {
    addCurrentSelection();
    cartButton.replaceChildren(createIcon('check-lg'));
    cartButton.classList.add('is-added');
    window.setTimeout(() => {
      cartButton.textContent = 'AGREGAR AL CARRITO';
      cartButton.classList.remove('is-added');
    }, 1800);
  });
  root.querySelector('[data-detail-buy]').addEventListener('click', (event) => {
    event.preventDefault();
    addCurrentSelection();
    window.location.href = '/carrito';
  });

  root.querySelectorAll('[data-product-content]').forEach((section) => {
    if (section !== relatedSection || relatedProducts.length) section.hidden = false;
  });
};

const initProductPage = async () => {
  const root = document.querySelector('[data-product-page]');
  if (!root) return;
  const loading = root.querySelector('[data-product-loading]');

  try {
    const response = await fetch('/api/products');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    const data = await response.json();
    const products = Array.isArray(data.products) ? data.products : [];
    const productId = new URLSearchParams(window.location.search).get('id');
    const product = products.find((item) => item.id === productId);

    if (!product) {
      loading.hidden = true;
      root.querySelector('[data-product-missing]').hidden = false;
      return;
    }

    loading.hidden = true;
    renderProduct(root, product, products);
  } catch (error) {
    loading.hidden = true;
    root.querySelector('[data-product-missing]').hidden = false;
    console.error(error);
  }
};

document.documentElement.classList.add('js');
initSiteNavigation();
initProductPage().finally(() => document.body.classList.add('is-ready'));
