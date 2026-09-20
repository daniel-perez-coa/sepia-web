import { initSiteNavigation } from './site-navigation.js';
import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { syncCartCount } from './cart-store.js';
import { getExplorePrice, productMatchesExploreFilters } from '../shared/explore-filters.js';

syncCartCount();

const PAGE_SIZE = 6;

const createCard = (product, index) => {
  const card = document.createElement('article');
  const label = document.createElement('span');
  const image = document.createElement('img');
  const title = document.createElement('h2');
  const collection = document.createElement('p');
  const description = document.createElement('small');
  const link = document.createElement('a');

  card.className = `explore-card${index % 4 === 1 ? ' explore-card--dark' : ''}`;
  card.style.setProperty('--card-order', String(index % PAGE_SIZE));
  label.className = 'explore-card__label meta';
  const labelText = product.promotionActive
    ? product.promotionLabel
    : (product.label || product.tags?.find(tag => tag.active)?.name || '');
  label.textContent = labelText || '';
  label.hidden = !labelText;
  if (product.photo) image.src = product.photo; else image.hidden = true;
  image.alt = `${product.title}: ${product.desc}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => {
    image.hidden = true;
    card.classList.add('has-missing-image');
  });
  card.classList.toggle('has-missing-image', !product.photo);
  title.textContent = product.title;
  collection.textContent = product.Collection;
  description.textContent = product.desc;
  link.href = `/producto?id=${encodeURIComponent(product.id || product.title)}`;
  link.append(document.createTextNode('INFORMACIÓN'));
  link.setAttribute('aria-label', `Información de ${product.title}`);

  card.append(label, image, title, collection, description, link);
  return card;
};



const initExplore = async () => {
  const root = document.querySelector('[data-explore]');
  if (!root) return;

  const grid = root.querySelector('[data-explore-grid]');
  const tabs = root.querySelector('[data-explore-tabs]');
  const filters = root.querySelector('[data-explore-filters]');
  const sort = root.querySelector('[data-explore-sort]');
  const count = root.querySelector('[data-explore-count]');
  const status = root.querySelector('[data-explore-status]');
  const empty = root.querySelector('[data-explore-empty]');
  const loadButton = root.querySelector('[data-explore-load]');
  const sentinel = root.querySelector('[data-explore-sentinel]');
  const header = document.querySelector('[data-explore-header]');
  const returnTop = document.querySelector('[data-explore-return]');
  let products = [];
  let visibleProducts = [];
  let renderedCount = 0;
  let activeFilterType = 'all';
  let activeFilterValue = '*';
  let isLoading = false;
  let userHasScrolled = false;
  let lastScrollY = window.scrollY;

  const productMatchesCategory = (product) => {
    if (activeFilterType === 'all') return true;
    if (activeFilterType === 'collection') {
      return product.collections?.some((collection) => collection.slug === activeFilterValue);
    }
    if (activeFilterType === 'category') {
      return product.categories?.some((category) => category.slug === activeFilterValue);
    }
    if (activeFilterType === 'subcategory') return product.subcategorySlug === activeFilterValue;
    if (activeFilterType === 'label') return product.label === activeFilterValue;
    return true;
  };

  const productMatchesFilters = (product) => {
    return productMatchesExploreFilters(product, {
      color: filters.elements.color.value,
      series: filters.elements.series.value,
      availability: filters.elements.availability.value,
      price: filters.elements.price.value,
    });
  };

  const sortProducts = (items) => {
    const sorted = [...items];
    if (sort.value === 'newest') {
      sorted.sort((first, second) => Number(second.label === 'NEW') - Number(first.label === 'NEW'));
    } else if (sort.value === 'price-asc') {
      sorted.sort((first, second) => getExplorePrice(first) - getExplorePrice(second));
    } else if (sort.value === 'price-desc') {
      sorted.sort((first, second) => getExplorePrice(second) - getExplorePrice(first));
    } else if (sort.value === 'name') {
      sorted.sort((first, second) => first.title.localeCompare(second.title, 'es'));
    } else if (sort.value === 'featured') {
      sorted.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.featuredOrder - b.featuredOrder);
    }
    return sorted;
  };

  const updateSummary = () => {
    const total = visibleProducts.length;
    count.textContent = `${total} ${total === 1 ? 'PRODUCTO' : 'PRODUCTOS'}`;
    empty.hidden = total !== 0;
    loadButton.hidden = total === 0 || renderedCount >= total;
    status.textContent = total === 0
      ? 'Prueba otra combinación de filtros.'
      : renderedCount >= total
        ? `${total} DE ${total} / TODOS CARGADOS`
        : `${renderedCount} DE ${total} / DESLIZA PARA CARGAR MÁS`;
  };

  const loadMore = () => {
    if (isLoading || renderedCount >= visibleProducts.length) return;
    isLoading = true;
    loadButton.classList.add('is-loading');
    const nextProducts = visibleProducts.slice(renderedCount, renderedCount + PAGE_SIZE);
    const cards = nextProducts.map((product, index) => createCard(product, renderedCount + index));
    grid.append(...cards);
    renderedCount += nextProducts.length;
    requestAnimationFrame(() => cards.forEach((card) => card.classList.add('is-visible')));
    isLoading = false;
    loadButton.classList.remove('is-loading');
    updateSummary();
  };

  const applyFilters = () => {
    visibleProducts = sortProducts(products.filter((product) => (
      productMatchesCategory(product) && productMatchesFilters(product)
    )));
    renderedCount = 0;
    grid.replaceChildren();
    loadMore();
    updateSummary();
  };

  tabs.addEventListener('click', (event) => {
    const selected = event.target.closest('button[data-filter-value]');
    if (!selected) return;
    activeFilterType = selected.dataset.filterType;
    activeFilterValue = selected.dataset.filterValue;
    [...tabs.children].forEach((button) => {
      const isActive = button === selected;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
      button.tabIndex = isActive ? 0 : -1;
    });
    applyFilters();
  });

  tabs.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const buttons = [...tabs.querySelectorAll('button[data-filter-value]')];
    const currentIndex = buttons.findIndex((button) => button.classList.contains('is-active'));
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? buttons.length - 1
        : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length;
    buttons[nextIndex].click();
    buttons[nextIndex].focus();
  });

  filters.addEventListener('change', applyFilters);
  filters.addEventListener('reset', () => requestAnimationFrame(applyFilters));
  sort.addEventListener('change', applyFilters);
  loadButton.addEventListener('click', loadMore);

  const maybeLoadMore = () => {
    if (!userHasScrolled || renderedCount >= visibleProducts.length) return;
    if (sentinel.getBoundingClientRect().top < window.innerHeight + 240) loadMore();
  };

  const loadObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) maybeLoadMore();
  }, { rootMargin: '240px 0px' });
  loadObserver.observe(sentinel);

  window.addEventListener('scroll', () => {
    const currentScrollY = window.scrollY;
    if (currentScrollY > 120) userHasScrolled = true;
    const isScrollingDown = currentScrollY > lastScrollY + 5;
    const isScrollingUp = currentScrollY < lastScrollY - 5;

    if (currentScrollY < 48 || isScrollingUp) header.classList.remove('is-hidden-on-scroll');
    else if (isScrollingDown && currentScrollY > 120) header.classList.add('is-hidden-on-scroll');

    returnTop.classList.toggle('is-visible', currentScrollY > 520);
    lastScrollY = currentScrollY;
    maybeLoadMore();
  }, { passive: true });

  try {
    const response = await fetch('/api/catalog');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
    const catalogTabs = Array.isArray(data.tabs) ? data.tabs : [];
    tabs.replaceChildren(...catalogTabs.map((tab, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'tab';
      button.textContent = tab.label;
      button.dataset.filterType = tab.filterType;
      button.dataset.filterValue = tab.filterValue;
      button.classList.toggle('is-active', index === 0);
      button.setAttribute('aria-selected', String(index === 0));
      button.tabIndex = index === 0 ? 0 : -1;
      return button;
    }));
    activeFilterType = catalogTabs[0]?.filterType ?? 'all';
    activeFilterValue = catalogTabs[0]?.filterValue ?? '*';
    applyFilters();
  } catch (error) {
    count.textContent = '0 PRODUCTOS';
    empty.hidden = false;
    empty.textContent = 'No pudimos cargar el catálogo. Intenta nuevamente.';
    loadButton.hidden = true;
    status.textContent = 'CATÁLOGO NO DISPONIBLE';
    console.error(error);
  }
};

document.documentElement.classList.add('js');
initSiteNavigation();
initExplore().finally(() => document.body.classList.add('is-ready'));
