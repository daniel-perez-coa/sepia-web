import 'bootstrap-icons/font/bootstrap-icons.css';

const createIcon = (name) => {
  const icon = document.createElement('i');
  icon.className = `bi bi-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

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

const initMenu = () => {
  const menuButton = document.querySelector('[data-menu-toggle]');
  const navigation = document.querySelector('[data-navigation]');

  const setMenuState = (isOpen) => {
    menuButton?.setAttribute('aria-expanded', String(isOpen));
    menuButton?.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    navigation?.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('menu-open', isOpen);
  };

  menuButton?.addEventListener('click', () => {
    setMenuState(menuButton.getAttribute('aria-expanded') !== 'true');
  });
  navigation?.addEventListener('click', () => setMenuState(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') setMenuState(false);
  });
};

const renderProduct = (root, product, products) => {
  const mainImage = root.querySelector('[data-detail-main-image]');
  const dimensionsImage = root.querySelector('[data-detail-dimensions-image]');
  const thumbnails = root.querySelector('[data-detail-thumbnails]');
  const edition = root.querySelector('[data-detail-edition]');
  const badges = root.querySelector('[data-detail-badges]');
  const options = root.querySelector('[data-detail-options]');
  const includes = root.querySelector('[data-detail-includes]');
  const facts = root.querySelector('[data-detail-facts]');
  const related = root.querySelector('[data-detail-related]');
  const quantityOutput = root.querySelector('[data-detail-quantity]');
  const previousButton = root.querySelector('[data-detail-previous]');
  const nextButton = root.querySelector('[data-detail-next]');
  const gallery = product.gallery?.length
    ? product.gallery
    : [{ src: product.photo, alt: product.desc }];
  let activeGalleryIndex = 0;
  let quantity = 1;

  root.querySelectorAll('[data-detail-collection]').forEach((element) => {
    element.textContent = product.Collection;
  });
  root.querySelector('[data-detail-breadcrumb]').textContent = product.title;
  root.querySelector('[data-detail-title]').textContent = product.title;
  root.querySelector('[data-detail-price]').textContent = product.price || 'PRECIO BAJO PEDIDO';
  root.querySelector('[data-detail-description]').textContent = product.longDescription || product.desc;
  root.querySelector('[data-detail-stock]').textContent = `${product.stock ?? 1} DISPONIBLES`;
  root.querySelector('[data-detail-story-eyebrow]').textContent = product.story?.eyebrow || 'LA HISTORIA';
  root.querySelector('[data-detail-story-title]').textContent = product.story?.title || product.title;
  root.querySelector('[data-detail-story-text]').textContent = product.story?.text || product.desc;
  root.querySelector('[data-detail-email]').href = `mailto:hola@sepia.mx?subject=${encodeURIComponent(`Consulta sobre ${product.title}`)}`;
  document.title = `${product.title} | SEPIA`;

  if (product.edition?.label) {
    const label = document.createElement('span');
    const count = document.createElement('strong');
    label.textContent = product.edition.label;
    count.textContent = `${product.edition.current} / ${product.edition.total}`;
    edition.replaceChildren(label, count);
    edition.hidden = false;
  }

  badges.replaceChildren(...(product.badges || []).map((badge) => {
    const element = document.createElement('span');
    element.textContent = badge;
    return element;
  }));

  options.replaceChildren(...(product.options || []).map((group) => {
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

  dimensionsImage.src = product.dimensionsMaterialsImage || product.photo;
  dimensionsImage.alt = product.dimensionsMaterialsAlt || `Dimensiones y materiales de ${product.title}`;

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
    ['DETALLES', product.details],
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

  const productById = new Map(products.map((item) => [item.id, item]));
  related.replaceChildren(...(product.relatedProducts || [])
    .map((productId) => productById.get(productId))
    .filter(Boolean)
    .map((relatedProduct) => {
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

  root.querySelector('[data-detail-decrease]').addEventListener('click', () => {
    quantity = Math.max(1, quantity - 1);
    quantityOutput.value = String(quantity);
    quantityOutput.textContent = String(quantity);
  });
  root.querySelector('[data-detail-increase]').addEventListener('click', () => {
    quantity = Math.min(product.stock || 1, quantity + 1);
    quantityOutput.value = String(quantity);
    quantityOutput.textContent = String(quantity);
  });

  root.querySelectorAll('[data-product-content]').forEach((section) => {
    section.hidden = false;
  });
};

const initProductPage = async () => {
  const root = document.querySelector('[data-product-page]');
  if (!root) return;

  try {
    const response = await fetch('/data/c_products.json');
    if (!response.ok) throw new Error('No se pudo cargar el catálogo');
    const data = await response.json();
    const products = Array.isArray(data.products) ? data.products : [];
    const productId = new URLSearchParams(window.location.search).get('id');
    const product = products.find((item) => item.id === productId);

    if (!product) {
      root.querySelector('[data-product-missing]').hidden = false;
      return;
    }

    renderProduct(root, product, products);
  } catch (error) {
    root.querySelector('[data-product-missing]').hidden = false;
    console.error(error);
  }
};

document.documentElement.classList.add('js');
initMenu();
initProductPage();
