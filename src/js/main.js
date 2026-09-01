import { collections } from './gallery-data.js';
import { siteConfig } from './site-config.js';

document.documentElement.classList.add('js');

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const menuButton = document.querySelector('[data-menu-toggle]');
const navigation = document.querySelector('[data-navigation]');
const header = document.querySelector('[data-header]');

const setMenuState = (isOpen) => {
  menuButton?.setAttribute('aria-expanded', String(isOpen));
  menuButton?.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
  navigation?.classList.toggle('is-open', isOpen);
  document.body.classList.toggle('menu-open', isOpen);
};

menuButton?.addEventListener('click', () => {
  const isOpen = menuButton.getAttribute('aria-expanded') === 'true';
  setMenuState(!isOpen);
});

navigation?.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenuState(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') setMenuState(false);
});

window.matchMedia('(min-width: 52rem)').addEventListener('change', (event) => {
  if (event.matches) setMenuState(false);
});

const syncHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

const typewriter = document.querySelector('[data-typewriter]');

if (typewriter && !prefersReducedMotion) {
  const messages = [
    'HACEMOS\nLO QUE\nSIGUE.',
    'LAS IDEAS\nSE HACEN COSAS.',
    'EL FUTURO\nSE HACE AQUÍ.',
  ];
  const typeDelay = 58;
  const deleteDelay = 28;
  const holdDelay = 1100;
  const resetDelay = 180;
  let messageIndex = 0;
  let characterIndex = 0;
  let isDeleting = false;

  const updateTypewriter = () => {
    const characters = Array.from(messages[messageIndex]);

    characterIndex += isDeleting ? -1 : 1;
    typewriter.textContent = characters.slice(0, characterIndex).join('');

    if (!isDeleting && characterIndex === characters.length) {
      isDeleting = true;
      window.setTimeout(updateTypewriter, holdDelay);
      return;
    }

    if (isDeleting && characterIndex === 0) {
      isDeleting = false;
      messageIndex = (messageIndex + 1) % messages.length;
      window.setTimeout(updateTypewriter, resetDelay);
      return;
    }

    window.setTimeout(updateTypewriter, isDeleting ? deleteDelay : typeDelay);
  };

  typewriter.textContent = '';
  window.setTimeout(updateTypewriter, 420);
}

const gallery = document.querySelector('[data-gallery]');

if (gallery) {
  const tabs = [...gallery.querySelectorAll('[data-gallery-tab]')];
  const panel = gallery.querySelector('[data-gallery-panel]');
  const previousButton = gallery.querySelector('[data-gallery-previous]');
  const nextButton = gallery.querySelector('[data-gallery-next]');
  const count = gallery.querySelector('[data-gallery-count]');
  const primaryImage = gallery.querySelector('[data-gallery-primary]');
  const secondaryImage = gallery.querySelector('[data-gallery-secondary]');
  const fields = {
    code: gallery.querySelector('[data-gallery-code]'),
    caption: gallery.querySelector('[data-gallery-caption]'),
    type: gallery.querySelector('[data-gallery-type]'),
    title: gallery.querySelector('[data-gallery-title]'),
    description: gallery.querySelector('[data-gallery-description]'),
    process: gallery.querySelector('[data-gallery-process]'),
    status: gallery.querySelector('[data-gallery-status]'),
    skin: gallery.querySelector('[data-gallery-skin]'),
  };
  let activeIndex = 0;
  let swapTimer;

  const applyCollection = (item) => {
    primaryImage.src = item.primary.src;
    primaryImage.alt = item.primary.alt;
    secondaryImage.src = item.secondary.src;
    secondaryImage.alt = item.secondary.alt;
    Object.entries(fields).forEach(([key, element]) => {
      if (element) element.textContent = item[key];
    });
    panel.style.setProperty('--gallery-accent', item.accent);
    panel.setAttribute('aria-labelledby', item.tabId);
    panel.setAttribute('aria-busy', 'false');
  };

  const selectCollection = (requestedIndex, focusTab = false) => {
    const index = (requestedIndex + collections.length) % collections.length;
    const item = collections[index];
    activeIndex = index;

    tabs.forEach((tab, tabIndex) => {
      const isSelected = tabIndex === index;
      tab.classList.toggle('is-active', isSelected);
      tab.setAttribute('aria-selected', String(isSelected));
      tab.setAttribute('tabindex', isSelected ? '0' : '-1');
    });

    count.textContent = `${String(index + 1).padStart(2, '0')} / ${String(collections.length).padStart(2, '0')}`;
    panel.setAttribute('aria-busy', 'true');
    panel.classList.add('is-changing');
    window.clearTimeout(swapTimer);
    swapTimer = window.setTimeout(() => {
      applyCollection(item);
      requestAnimationFrame(() => panel.classList.remove('is-changing'));
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 140);

    if (focusTab) tabs[index].focus();
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectCollection(index));
  });

  gallery.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
    const keyActions = {
      ArrowLeft: activeIndex - 1,
      ArrowRight: activeIndex + 1,
      Home: 0,
      End: collections.length - 1,
    };

    if (keyActions[event.key] !== undefined) {
      event.preventDefault();
      selectCollection(keyActions[event.key], true);
    }
  });

  previousButton?.addEventListener('click', () => selectCollection(activeIndex - 1));
  nextButton?.addEventListener('click', () => selectCollection(activeIndex + 1));

  const preloadCollections = () => {
    collections.flatMap((item) => [item.primary.src, item.secondary.src]).forEach((source) => {
      const image = new Image();
      image.src = source;
    });
  };

  window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(preloadCollections, { timeout: 2500 });
    } else {
      window.setTimeout(preloadCollections, 800);
    }
  });

  panel.style.setProperty('--gallery-accent', collections[0].accent);
}

const emailLink = document.querySelector('[data-contact-email]');
if (emailLink) {
  emailLink.href = `mailto:${siteConfig.contact.email}`;
  emailLink.textContent = `${siteConfig.contact.email} ↗`;
}

document.querySelectorAll('[data-social]').forEach((link) => {
  const social = siteConfig.socials[link.dataset.social];
  if (!social) return;
  link.href = social.url;
  const label = link.querySelector('[data-social-label]');
  if (label) label.textContent = `${social.label} ↗`;
});

document.querySelectorAll('[data-current-year]').forEach((element) => {
  element.textContent = String(new Date().getFullYear());
});

const revealItems = document.querySelectorAll('[data-reveal]');
if (!prefersReducedMotion && 'IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14 },
  );

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}
