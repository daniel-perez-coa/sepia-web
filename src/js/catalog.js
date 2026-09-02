const ITEMS_PER_PAGE = 5;

const createIcon = (name) => {
  const icon = document.createElement('i');
  icon.className = `bi bi-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

const DATA_URLS = [
  '/data/c_toys.json',
  '/data/c_tabs.json',
  '/data/c_products.json',
];

const allowedPosition = new Set(['left', 'center', 'right']);
const allowedVertical = new Set(['top', 'center', 'bottom']);
const allowedJustify = new Set(['start', 'center', 'end']);
const allowedRounded = new Set(['none', 'soft', 'pill']);

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
  const horizontal = allowedPosition.has(adjustments.horizontal) ? adjustments.horizontal : 'left';
  const vertical = allowedVertical.has(adjustments.vertical) ? adjustments.vertical : 'center';
  const textAlign = allowedPosition.has(adjustments.textAlign) ? adjustments.textAlign : horizontal;
  const justify = allowedJustify.has(adjustments.justify) ? adjustments.justify : 'start';
  const rounded = allowedRounded.has(adjustments.rounded) ? adjustments.rounded : 'none';

  element.dataset.horizontal = horizontal;
  element.dataset.vertical = vertical;
  element.dataset.textAlign = textAlign;
  element.dataset.justify = justify;
  element.classList.toggle('is-boxed', adjustments.boxed === true);
  element.classList.remove('is-rounded-none', 'is-rounded-soft', 'is-rounded-pill');
  element.classList.add(`is-rounded-${rounded}`);
};

const createProductCard = (product, index) => {
  const card = document.createElement('article');
  card.className = `product-card${index % 2 === 1 ? ' product-card--dark' : ''}`;

  const label = document.createElement('span');
  label.className = 'product-card__label meta';
  label.textContent = product.label;

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
  link.href = product.link;
  link.append(document.createTextNode('INFO'), createIcon('arrow-up-right'));
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

  try {
    const [toyData, tabData, productData] = await Promise.all(DATA_URLS.map(fetchJson));
    const slides = Array.isArray(toyData.destacados) ? toyData.destacados : [];
    const tabs = Array.isArray(tabData.tabs) ? tabData.tabs : [];
    const products = Array.isArray(productData.products) ? productData.products : [];
    const autoplayMs = Math.max(3000, Number(toyData.autoplayMs) || 6500);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let featuredIndex = 0;
    let featuredTimer;
    let swapTimer;
    let activeCollection = tabs[0]?.Collection ?? '*';
    let activePage = 0;

    const renderFeatured = (index, animate = true) => {
      if (!slides.length) return;
      featuredIndex = (index + slides.length) % slides.length;
      const slide = slides[featuredIndex];

      window.clearTimeout(swapTimer);
      featured.classList.toggle('is-changing', animate && !prefersReducedMotion);
      swapTimer = window.setTimeout(() => {
        featuredPhoto.src = slide.Photo;
        featuredPhoto.alt = `${slide.Titulo2.replace(/\[[^\]]+\]/g, '').replace(/\n/g, ' ')}, colección destacada`;
        renderRichText(featuredTitle1, slide.Titulo1);
        renderRichText(featuredTitle2, slide.Titulo2);
        applyAdjustments(featuredTitle1, slide.Titulo1adj);
        applyAdjustments(featuredTitle2, slide.Titulo2adj);
        featuredContent.dataset.vertical = allowedVertical.has(slide.Titulo2adj?.vertical)
          ? slide.Titulo2adj.vertical
          : 'center';
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

    const getFilteredProducts = () => (
      activeCollection === '*'
        ? products
        : products.filter((product) => product.Collection === activeCollection)
    );

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

      const activeTab = tabs.find((tab) => tab.Collection === activeCollection);
      status.textContent = filtered.length
        ? `${start + 1}-${Math.min(start + ITEMS_PER_PAGE, filtered.length)} de ${filtered.length} / ${activeTab?.label ?? 'TODOS'}`
        : `Sin productos / ${activeTab?.label ?? ''}`;
    };

    const selectTab = (tab, focus = false) => {
      activeCollection = tab.Collection;
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
      const currentIndex = tabs.findIndex((tab) => tab.Collection === activeCollection);
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
    status.textContent = 'El catálogo no pudo actualizarse. Mostrando la selección disponible.';
    console.error(error);
  }
};
