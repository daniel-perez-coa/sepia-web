import 'bootstrap-icons/font/bootstrap-icons.css';

const PAGE_SIZE = 6;

const normalizeText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const getPrice = (product) => Number(String(product.price || '').replace(/[^\d]/g, '')) || 0;

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
  label.textContent = product.label;
  image.src = product.photo;
  image.alt = `${product.title}: ${product.desc}`;
  image.loading = 'lazy';
  image.decoding = 'async';
  title.textContent = product.title;
  collection.textContent = product.Collection;
  description.textContent = product.desc;
  link.href = `/producto?id=${encodeURIComponent(product.id || product.title)}`;
  link.append(document.createTextNode('INFORMACIÓN'));
  link.setAttribute('aria-label', `Información de ${product.title}`);

  card.append(label, image, title, collection, description, link);
  return card;
};

const initMenu = () => {
  const button = document.querySelector('[data-menu-toggle]');
  const navigation = document.querySelector('[data-navigation]');

  const setOpen = (isOpen) => {
    button?.setAttribute('aria-expanded', String(isOpen));
    button?.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    navigation?.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('menu-open', isOpen);
  };

  button?.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  navigation?.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setOpen(false);
  });
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
  let activeCategory = '*';
  let isLoading = false;
  let userHasScrolled = false;
  let lastScrollY = window.scrollY;

  const productMatchesCategory = (product) => {
    if (activeCategory === '*') return true;
    if (['NEW', 'DROP_01'].includes(activeCategory)) return product.label === activeCategory;
    return product.Collection === activeCategory;
  };

  const productMatchesFilters = (product) => {
    const color = filters.elements.color.value;
    const series = filters.elements.series.value;
    const availability = filters.elements.availability.value;
    const price = filters.elements.price.value;
    const searchable = normalizeText(JSON.stringify(product));
    const numericPrice = getPrice(product);

    if (color !== '*' && !searchable.includes(normalizeText(color))) return false;
    if (series !== '*' && product.label !== series) return false;
    if (availability === 'available' && product.stock <= 0) return false;
    if (availability === 'low' && !(product.stock > 0 && product.stock <= 5)) return false;
    if (availability === 'sold-out' && product.stock > 0) return false;
    if (price === 'under-600' && numericPrice >= 600) return false;
    if (price === '600-999' && !(numericPrice >= 600 && numericPrice < 1000)) return false;
    if (price === 'over-1000' && numericPrice < 1000) return false;
    return true;
  };

  const sortProducts = (items) => {
    const sorted = [...items];
    if (sort.value === 'newest') {
      sorted.sort((first, second) => Number(second.label === 'NEW') - Number(first.label === 'NEW'));
    } else if (sort.value === 'price-asc') {
      sorted.sort((first, second) => getPrice(first) - getPrice(second));
    } else if (sort.value === 'price-desc') {
      sorted.sort((first, second) => getPrice(second) - getPrice(first));
    } else if (sort.value === 'name') {
      sorted.sort((first, second) => first.title.localeCompare(second.title, 'es'));
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
    const selected = event.target.closest('button[data-category]');
    if (!selected) return;
    activeCategory = selected.dataset.category;
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
    const buttons = [...tabs.querySelectorAll('button[data-category]')];
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
    const response = await fetch('/data/c_products.json');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    const data = await response.json();
    products = Array.isArray(data.products) ? data.products : [];
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
initMenu();
initExplore();
