import { normalizeFeaturedAdjustments } from '../shared/featured-config.js';

const ITEMS_PER_PAGE = 5;

const createIcon = (name) => {
  const icon = document.createElement('i');
  icon.className = `bi bi-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

const fetchJson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo cargar ${url}`);
  return response.json();
};

const richTokenPattern = /\[bold\]|\[\/bold\]|\[color=(#[\da-fA-F]{6})(?:;opacity=(0(?:\.\d+)?|1(?:\.0+)?))?\]|\[\/color\]|\n/g;

const createRichFragment = (value = '') => {
  const fragment = document.createDocumentFragment();
  const stack = [{ type: 'root', node: fragment }];
  let cursor = 0;

  for (const match of value.matchAll(richTokenPattern)) {
    const [token, color, opacity] = match;
    const current = stack.at(-1).node;

    if (match.index > cursor) {
      current.append(document.createTextNode(value.slice(cursor, match.index)));
    }

    if (token === '\n') {
      current.append(document.createElement('br'));
    } else if (token === '[bold]') {
      const strong = document.createElement('strong');
      current.append(strong);
      stack.push({ type: 'bold', node: strong });
    } else if (token === '[/bold]' && stack.at(-1).type === 'bold') {
      stack.pop();
    } else if (token.startsWith('[color=')) {
      const span = document.createElement('span');
      span.style.color = color;
      if (opacity !== undefined) span.style.opacity = String(Math.min(1, Math.max(0, Number(opacity))));
      current.append(span);
      stack.push({ type: 'color', node: span });
    } else if (token === '[/color]' && stack.at(-1).type === 'color') {
      stack.pop();
    }

    cursor = match.index + token.length;
  }

  stack.at(-1).node.append(document.createTextNode(value.slice(cursor)));
  return fragment;
};

const renderRichText = (element, value) => {
  element.replaceChildren(createRichFragment(value));
};

const applyAdjustments = (element, adjustments = {}) => {
  const normalized = normalizeFeaturedAdjustments(adjustments);
  const { horizontal, vertical, rounded, boxed } = normalized;

  element.dataset.horizontal = horizontal;
  element.dataset.vertical = vertical;
  element.classList.toggle('is-boxed', boxed);
  element.classList.remove('is-rounded-none', 'is-rounded-soft', 'is-rounded-pill');
  element.classList.add(`is-rounded-${rounded}`);
};

// Shared by the public carousel and the administration preview.
export const paintFeatured = (card, slide) => {
  const photo = card.querySelector('.featured-card__photo') || card.querySelector(':scope > img');
  const label = card.querySelector('.featured-card__label');
  const title = card.querySelector('h3');
  const content = card.querySelector('.featured-card__content');
  const photoUrl = slide.Photo || '';
  if (!photo.dataset.errorHandler) {
    photo.dataset.errorHandler = 'true';
    photo.addEventListener('error', () => { photo.dataset.failedUrl = photo.dataset.source ?? ''; photo.hidden = true; });
  }
  if (photo.dataset.source !== photoUrl) { photo.dataset.source = photoUrl; delete photo.dataset.failedUrl; photo.src = photoUrl; }
  photo.hidden = !photoUrl || photo.dataset.failedUrl === photoUrl; photo.alt = slide.imageAlt || '';
  renderRichText(label, slide.Titulo1); renderRichText(title, slide.Titulo2);
  label.hidden = !slide.Titulo1;
  applyAdjustments(label, slide.Titulo1adj); applyAdjustments(title, slide.Titulo2adj);
  content.dataset.vertical = normalizeFeaturedAdjustments(slide.Titulo2adj).vertical;
  content.querySelector('p').textContent = slide.text;
  const link = content.querySelector('a'); link.textContent = slide.LinkText; link.href = slide.LinkUrl;
  link.classList.toggle('has-line', slide.Line === 'yes');
  card.dataset.template = slide.template || 'editorial-left';
  card.style.setProperty('--featured-overlay', slide.overlayColor || '#142fd3');
  card.style.setProperty('--featured-text', slide.textColor || '#ffffff');
  card.style.setProperty('--featured-opacity', String(slide.overlayOpacity ?? 0.9));
  card.style.setProperty('--featured-link', slide.linkColor || '#ffffff');
  card.style.setProperty('--featured-line', slide.lineColor || '#ffffff');
  card.style.setProperty('--featured-label', slide.labelColor || '#ffffff');
  card.style.setProperty('--featured-title-box', slide.titleBoxColor || slide.textColor || '#ffffff');
  if (Number(slide.titleSize) > 0) card.style.setProperty('--featured-title-size', `${slide.titleSize}px`); else card.style.removeProperty('--featured-title-size');
  if (Number(slide.descriptionSize) > 0) card.style.setProperty('--featured-description-size', `${slide.descriptionSize}px`); else card.style.removeProperty('--featured-description-size');
};

const createProductCard = (product, index) => {
  const card = document.createElement('article');
  card.className = `product-card${index % 2 === 1 ? ' product-card--dark' : ''}`;

  const label = document.createElement('span');
  label.className = 'product-card__label meta';
  const labelText = product.promotionActive ? product.promotionLabel : product.tags?.find(tag => tag.active)?.name;
  label.textContent = labelText || '';
  label.hidden = !labelText;

  const image = document.createElement('img');
  image.src = product.photo;
  image.alt = `${product.title}: ${product.desc}`;
  image.loading = 'lazy';
  image.decoding = 'async';

  const title = document.createElement('h3');
  title.textContent = product.title;

  const collection = document.createElement('p');
  collection.textContent = product.Collection;

  const description = document.createElement('small');
  description.textContent = product.desc;

  const link = document.createElement('a');
  link.href = `/producto?id=${encodeURIComponent(product.id || product.title)}`;
  link.append(document.createTextNode('INFORMACIÓN'));
  link.setAttribute('aria-label', `Información de ${product.title}`);

  card.append(label, image, title, collection, description, link);
  return card;
};

export const initCatalog = async () => {
  const catalog = document.querySelector('[data-catalog]');
  if (!catalog) return;

  const featured = catalog.querySelector('[data-featured]');
  const featuredPhoto = catalog.querySelector('[data-featured-photo]');
  const featuredTitle1 = catalog.querySelector('[data-featured-title1]');
  const featuredTitle2 = catalog.querySelector('[data-featured-title2]');
  const featuredContent = catalog.querySelector('[data-featured-content]');
  const featuredText = catalog.querySelector('[data-featured-text]');
  const featuredLink = catalog.querySelector('[data-featured-link]');
  const featuredDots = catalog.querySelector('[data-featured-dots]');
  const previousFeatured = catalog.querySelector('[data-featured-previous]');
  const nextFeatured = catalog.querySelector('[data-featured-next]');
  const tabList = catalog.querySelector('[data-catalog-tabs]');
  const productGrid = catalog.querySelector('[data-product-grid]');
  const pagination = catalog.querySelector('[data-catalog-pagination]');
  const status = catalog.querySelector('[data-catalog-status]');
  // Never leave hard-coded products/banners visible after deactivation or an API failure.
  featured.hidden = true;
  productGrid.replaceChildren();

  try {
    const catalogData = await fetchJson('/api/catalog');
    const signalTrack = document.querySelector('[data-site-signal-track]');
    if (signalTrack) {
      const count = 12, text = catalogData.signalText ?? 'MAKE / PRODUCE / MOVE / SHIFT', icon = catalogData.signalIcon ?? '';
      signalTrack.replaceChildren(...Array.from({ length: count }, () => {
        const item = document.createElement('span');
        if (text) item.append(document.createTextNode(text));
        if (icon) { const glyph = document.createElement('i'); glyph.className = `bi bi-${icon}`; glyph.setAttribute('aria-hidden', 'true'); item.append(text ? document.createTextNode(' ') : '', glyph); }
        return item;
      }));
    }
    const slides = Array.isArray(catalogData.destacados) ? catalogData.destacados : [];
    featured.hidden = slides.length === 0;
    catalog.classList.toggle('catalog--without-featured', slides.length === 0);
    const tabs = Array.isArray(catalogData.tabs) ? catalogData.tabs : [];
    const products = Array.isArray(catalogData.products) ? catalogData.products : [];
    const autoplayMs = Math.max(3000, Number(catalogData.autoplayMs) || 6500);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let featuredIndex = 0;
    let featuredTimer;
    let swapTimer;
    let activeTab = tabs[0] ?? { id: 'todos', label: 'TODOS', filterType: 'all', filterValue: '*' };
    let activePage = 0;

    const renderFeatured = (index, animate = true) => {
      if (!slides.length) return;
      featuredIndex = (index + slides.length) % slides.length;
      const slide = slides[featuredIndex];

      window.clearTimeout(swapTimer);
      featured.classList.toggle('is-changing', animate && !prefersReducedMotion);
      swapTimer = window.setTimeout(() => {
        paintFeatured(featured, slide);
        featuredPhoto.src = slide.Photo;
        featuredPhoto.alt = slide.imageAlt || `${slide.Titulo2.replace(/\[[^\]]+\]/g, '').replace(/\n/g, ' ')}, colección destacada`;
        renderRichText(featuredTitle1, slide.Titulo1);
        renderRichText(featuredTitle2, slide.Titulo2);
        applyAdjustments(featuredTitle1, slide.Titulo1adj);
        applyAdjustments(featuredTitle2, slide.Titulo2adj);
        featuredContent.dataset.vertical = normalizeFeaturedAdjustments(slide.Titulo2adj).vertical;
        featuredText.textContent = slide.text;
        featuredLink.textContent = slide.LinkText;
        featuredLink.href = slide.LinkUrl;
        featuredLink.classList.toggle('has-line', String(slide.Line).toLowerCase() === 'yes');
        [...featuredDots.children].forEach((dot, dotIndex) => {
          const isActive = dotIndex === featuredIndex;
          dot.classList.toggle('is-active', isActive);
          dot.setAttribute('aria-current', isActive ? 'true' : 'false');
        });
        featured.classList.remove('is-changing');
      }, animate && !prefersReducedMotion ? 180 : 0);
    };

    const startFeaturedTimer = () => {
      window.clearInterval(featuredTimer);
      if (prefersReducedMotion || slides.length < 2) return;
      featuredTimer = window.setInterval(() => renderFeatured(featuredIndex + 1), autoplayMs);
    };

    const selectFeatured = (index) => {
      renderFeatured(index);
      startFeaturedTimer();
    };

    featuredDots.replaceChildren();
    slides.forEach((slide, index) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.setAttribute('aria-label', `Mostrar ${slide.Titulo2.replace(/\[[^\]]+\]/g, '').replace(/\n/g, ' ')}`);
      dot.addEventListener('click', () => selectFeatured(index));
      featuredDots.append(dot);
    });

    previousFeatured.addEventListener('click', () => selectFeatured(featuredIndex - 1));
    nextFeatured.addEventListener('click', () => selectFeatured(featuredIndex + 1));
    featured.addEventListener('pointerenter', () => window.clearInterval(featuredTimer));
    featured.addEventListener('pointerleave', startFeaturedTimer);
    featured.addEventListener('focusin', () => window.clearInterval(featuredTimer));
    featured.addEventListener('focusout', (event) => {
      if (!featured.contains(event.relatedTarget)) startFeaturedTimer();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) window.clearInterval(featuredTimer);
      else startFeaturedTimer();
    });

    const getFilteredProducts = () => products.filter((product) => {
      if (activeTab.filterType === 'all') return true;
      if (activeTab.filterType === 'collection') {
        return product.collections?.some((collection) => collection.slug === activeTab.filterValue);
      }
      if (activeTab.filterType === 'category') {
        return product.categories?.some((category) => category.slug === activeTab.filterValue);
      }
      if (activeTab.filterType === 'subcategory') return product.subcategorySlug === activeTab.filterValue;
      return true;
    });

    const renderProducts = (animate = true) => {
      const filtered = getFilteredProducts();
      const pageCount = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
      activePage = Math.min(activePage, pageCount - 1);
      const start = activePage * ITEMS_PER_PAGE;
      const visibleProducts = filtered.slice(start, start + ITEMS_PER_PAGE);

      productGrid.classList.toggle('is-changing', animate && !prefersReducedMotion);
      window.setTimeout(() => {
        productGrid.replaceChildren(...visibleProducts.map(createProductCard));
        productGrid.classList.remove('is-changing');
      }, animate && !prefersReducedMotion ? 120 : 0);

      pagination.replaceChildren();
      const previous = document.createElement('button');
      previous.type = 'button';
      previous.append(createIcon('arrow-left'));
      previous.disabled = activePage === 0;
      previous.setAttribute('aria-label', 'Página anterior');
      previous.addEventListener('click', () => {
        activePage -= 1;
        renderProducts();
      });
      pagination.append(previous);

      for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
        const pageButton = document.createElement('button');
        pageButton.type = 'button';
        pageButton.textContent = String(pageIndex + 1).padStart(2, '0');
        pageButton.classList.toggle('is-active', pageIndex === activePage);
        if (pageIndex === activePage) pageButton.setAttribute('aria-current', 'page');
        pageButton.addEventListener('click', () => {
          activePage = pageIndex;
          renderProducts();
        });
        pagination.append(pageButton);
      }

      const next = document.createElement('button');
      next.type = 'button';
      next.append(createIcon('arrow-right'));
      next.disabled = activePage >= pageCount - 1;
      next.setAttribute('aria-label', 'Página siguiente');
      next.addEventListener('click', () => {
        activePage += 1;
        renderProducts();
      });
      pagination.append(next);

      status.textContent = filtered.length
        ? `${start + 1}-${Math.min(start + ITEMS_PER_PAGE, filtered.length)} de ${filtered.length} / ${activeTab?.label ?? 'TODOS'}`
        : `Sin productos / ${activeTab?.label ?? ''}`;
    };

    const selectTab = (tab, focus = false) => {
      activeTab = tab;
      activePage = 0;
      [...tabList.children].forEach((button) => {
        const isActive = button.dataset.tabId === tab.id;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-selected', String(isActive));
        button.tabIndex = isActive ? 0 : -1;
        if (focus && isActive) button.focus();
      });
      renderProducts();
    };

    tabList.replaceChildren();
    tabs.forEach((tab, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.dataset.tabId = tab.id;
      button.textContent = tab.label;
      button.setAttribute('aria-selected', String(index === 0));
      button.tabIndex = index === 0 ? 0 : -1;
      button.classList.toggle('is-active', index === 0);
      button.addEventListener('click', () => selectTab(tab));
      tabList.append(button);
    });

    tabList.addEventListener('keydown', (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = tabs.findIndex((tab) => tab.id === activeTab.id);
      const targetIndex = event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      selectTab(tabs[targetIndex], true);
    });

    renderFeatured(0, false);
    renderProducts(false);
    startFeaturedTimer();
  } catch (error) {
    status.textContent = 'No se pudo cargar el catálogo. Intenta recargar la página.';
    console.error(error);
  }
};
