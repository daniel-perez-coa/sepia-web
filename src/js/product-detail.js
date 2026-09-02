const createIcon = (name) => {
  const icon = document.createElement('i');
  icon.className = `bi bi-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

const detailHash = (productId) => `#producto-${encodeURIComponent(productId)}`;

const productIdFromHash = (hash) => {
  const match = hash.match(/^#producto-(.+)$/);
  return match ? decodeURIComponent(match[1]) : null;
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

export const initProductDetail = (products) => {
  const dialog = document.querySelector('[data-product-detail]');
  if (!dialog || !products.length) return;

  const productById = new Map(products.map((product) => [product.id || product.title, product]));
  const mainImage = dialog.querySelector('[data-detail-main-image]');
  const dimensionsImage = dialog.querySelector('[data-detail-dimensions-image]');
  const thumbnails = dialog.querySelector('[data-detail-thumbnails]');
  const edition = dialog.querySelector('[data-detail-edition]');
  const badges = dialog.querySelector('[data-detail-badges]');
  const options = dialog.querySelector('[data-detail-options]');
  const includes = dialog.querySelector('[data-detail-includes]');
  const facts = dialog.querySelector('[data-detail-facts]');
  const related = dialog.querySelector('[data-detail-related]');
  const quantityOutput = dialog.querySelector('[data-detail-quantity]');
  const contactLink = dialog.querySelector('[data-detail-contact]');
  const emailLink = dialog.querySelector('[data-detail-email]');
  const closeButton = dialog.querySelector('[data-detail-close]');
  const previousButton = dialog.querySelector('[data-detail-previous]');
  const nextButton = dialog.querySelector('[data-detail-next]');
  let activeProduct = null;
  let activeGalleryIndex = 0;
  let quantity = 1;
  let ownsHistoryEntry = false;

  const getGallery = (product) => {
    const gallery = Array.isArray(product.gallery) ? product.gallery : [];
    return gallery.length ? gallery : [{ src: product.photo, alt: product.desc }];
  };

  const renderGalleryImage = (index) => {
    const gallery = getGallery(activeProduct);
    activeGalleryIndex = (index + gallery.length) % gallery.length;
    const selectedImage = gallery[activeGalleryIndex];
    mainImage.src = selectedImage.src;
    mainImage.alt = selectedImage.alt || `${activeProduct.title}, vista ${activeGalleryIndex + 1}`;
    [...thumbnails.children].forEach((button, buttonIndex) => {
      const isActive = buttonIndex === activeGalleryIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    previousButton.hidden = gallery.length < 2;
    nextButton.hidden = gallery.length < 2;
  };

  const renderOptions = (groups = []) => {
    options.replaceChildren();
    groups.forEach((group) => {
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
      options.append(fieldset);
    });
  };

  const renderFacts = (product) => {
    facts.replaceChildren();
    [
      ['DETALLES', product.details],
      ['ESPECIFICACIONES', product.specifications],
    ].forEach(([title, rows], index) => {
      if (!Array.isArray(rows) || !rows.length) return;
      const disclosure = document.createElement('details');
      const summary = document.createElement('summary');
      const content = document.createElement('div');
      summary.append(document.createTextNode(title), createIcon(index === 0 ? 'dash-lg' : 'plus-lg'));
      appendFactRows(content, rows);
      disclosure.open = index === 0;
      disclosure.addEventListener('toggle', () => {
        const icon = summary.querySelector('i');
        icon.className = `bi bi-${disclosure.open ? 'dash-lg' : 'plus-lg'}`;
      });
      disclosure.append(summary, content);
      facts.append(disclosure);
    });
  };

  const openProduct = (product, historyMode = 'push') => {
    if (!product) return;
    activeProduct = product;
    activeGalleryIndex = 0;
    quantity = 1;
    quantityOutput.value = '1';
    quantityOutput.textContent = '1';

    dialog.querySelectorAll('[data-detail-collection]').forEach((element) => {
      element.textContent = product.Collection;
    });
    dialog.querySelector('[data-detail-breadcrumb]').textContent = product.title;
    dialog.querySelector('[data-detail-title]').textContent = product.title;
    dialog.querySelector('[data-detail-price]').textContent = product.price || 'PRECIO BAJO PEDIDO';
    dialog.querySelector('[data-detail-description]').textContent = product.longDescription || product.desc;
    dialog.querySelector('[data-detail-stock]').textContent = `${product.stock ?? 1} DISPONIBLES`;
    dialog.querySelector('[data-detail-story-eyebrow]').textContent = product.story?.eyebrow || 'LA HISTORIA';
    dialog.querySelector('[data-detail-story-title]').textContent = product.story?.title || product.title;
    dialog.querySelector('[data-detail-story-text]').textContent = product.story?.text || product.desc;

    if (product.edition?.label) {
      edition.hidden = false;
      edition.replaceChildren();
      const label = document.createElement('span');
      const count = document.createElement('strong');
      label.textContent = product.edition.label;
      count.textContent = `${product.edition.current} / ${product.edition.total}`;
      edition.append(label, count);
    } else {
      edition.hidden = true;
    }

    badges.replaceChildren(...(product.badges || []).map((badge) => {
      const element = document.createElement('span');
      element.textContent = badge;
      return element;
    }));

    renderOptions(product.options || []);

    includes.replaceChildren(...(product.includes || []).map((item) => {
      const listItem = document.createElement('li');
      listItem.append(createIcon(item.icon || 'check2-circle'), document.createTextNode(item.text));
      return listItem;
    }));

    dimensionsImage.src = product.dimensionsMaterialsImage || product.photo;
    dimensionsImage.alt = product.dimensionsMaterialsAlt || `Dimensiones y materiales de ${product.title}`;

    const gallery = getGallery(product);
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
    renderGalleryImage(0);
    renderFacts(product);

    related.replaceChildren(...(product.relatedProducts || [])
      .map((productId) => productById.get(productId))
      .filter(Boolean)
      .map((relatedProduct) => {
        const button = document.createElement('button');
        const image = document.createElement('img');
        const copy = document.createElement('span');
        const title = document.createElement('strong');
        const collection = document.createElement('small');
        button.type = 'button';
        button.setAttribute('aria-label', `Ver información de ${relatedProduct.title}`);
        image.src = relatedProduct.photo;
        image.alt = '';
        title.textContent = relatedProduct.title;
        collection.textContent = relatedProduct.Collection;
        copy.append(title, collection);
        button.append(image, copy, createIcon('arrow-up-right'));
        button.addEventListener('click', () => {
          openProduct(relatedProduct, 'replace');
          dialog.scrollTo({ top: 0, behavior: 'smooth' });
        });
        return button;
      }));

    const subject = encodeURIComponent(`Consulta sobre ${product.title}`);
    emailLink.href = `mailto:hola@sepia.mx?subject=${subject}`;

    if (historyMode !== 'none') {
      const method = historyMode === 'replace' ? 'replaceState' : 'pushState';
      window.history[method]({ productId: product.id }, '', detailHash(product.id));
      if (historyMode === 'push') ownsHistoryEntry = true;
    }

    if (!dialog.open) {
      dialog.showModal();
      document.body.classList.add('product-detail-open');
    }
  };

  const closeProduct = (restoreHistory = true) => {
    if (!dialog.open) return;
    if (restoreHistory && ownsHistoryEntry && productIdFromHash(window.location.hash)) {
      window.history.back();
      return;
    }
    if (restoreHistory && productIdFromHash(window.location.hash)) {
      window.history.replaceState(null, '', '#catalogo');
    }
    dialog.close();
    document.body.classList.remove('product-detail-open');
    activeProduct = null;
    ownsHistoryEntry = false;
  };

  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeProduct();
  });
  closeButton.addEventListener('click', () => closeProduct());
  previousButton.addEventListener('click', () => renderGalleryImage(activeGalleryIndex - 1));
  nextButton.addEventListener('click', () => renderGalleryImage(activeGalleryIndex + 1));
  dialog.querySelector('[data-detail-decrease]').addEventListener('click', () => {
    quantity = Math.max(1, quantity - 1);
    quantityOutput.value = String(quantity);
    quantityOutput.textContent = String(quantity);
  });
  dialog.querySelector('[data-detail-increase]').addEventListener('click', () => {
    quantity = Math.min(activeProduct?.stock || 1, quantity + 1);
    quantityOutput.value = String(quantity);
    quantityOutput.textContent = String(quantity);
  });
  contactLink.addEventListener('click', () => {
    closeProduct(false);
    window.history.replaceState(null, '', '#catalogo');
  });

  window.addEventListener('popstate', () => {
    const product = productById.get(productIdFromHash(window.location.hash));
    if (product) openProduct(product, 'none');
    else closeProduct(false);
  });

  const initialProduct = productById.get(productIdFromHash(window.location.hash));
  if (initialProduct) openProduct(initialProduct, 'none');

  return { openProduct };
};
