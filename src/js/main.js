import { initCatalog } from './catalog.js';
import { siteConfig } from './site-config.js';

document.documentElement.classList.add('js');

initCatalog();

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const menuButton = document.querySelector('[data-menu-toggle]');
const navigation = document.querySelector('[data-navigation]');
const header = document.querySelector('[data-header]');
const pageViews = [...document.querySelectorAll('[data-page-view]')];

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

let activeViewIndex = 0;
let isAutoSnapping = false;
let autoSnapTimer;

const getViewIndex = () => {
  const viewportMarker = window.scrollY + window.innerHeight * 0.5;
  return pageViews.reduce(
    (activeIndex, view, index) => (view.offsetTop <= viewportMarker ? index : activeIndex),
    0,
  );
};

const syncHeader = () => {
  const nextViewIndex = getViewIndex();
  const activeView = pageViews[nextViewIndex];
  document.body.dataset.activeView = activeView?.id ?? 'inicio';
  header?.classList.toggle('is-scrolled', window.scrollY > 24 && nextViewIndex === 0);
  header?.classList.toggle('is-section-view', nextViewIndex === 1);
  header?.classList.toggle('is-hidden', nextViewIndex === 2);

  if (isAutoSnapping || nextViewIndex === activeViewIndex) return;

  activeViewIndex = nextViewIndex;
  isAutoSnapping = true;
  pageViews[activeViewIndex]?.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });
  window.clearTimeout(autoSnapTimer);
  autoSnapTimer = window.setTimeout(() => {
    isAutoSnapping = false;
  }, prefersReducedMotion ? 80 : 850);
};

activeViewIndex = getViewIndex();
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });
window.addEventListener('resize', syncHeader, { passive: true });

document.querySelectorAll('[data-return-top]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });
  });
});

const typewriter = document.querySelector('[data-typewriter]');

if (typewriter && !prefersReducedMotion) {
  const messages = [
    'HACEMOS\nLO QUE\nSIGUE.',
    'LAS IDEAS\nSE HACEN\nCOSAS.',
    'EL FUTURO\nSE HACE\nAQUÍ.',
  ];
  const typeDelay = 82;
  const lineDelay = 240;
  const deleteDelay = 45;
  const holdDelay = 1900;
  const resetDelay = 400;
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

    const typedCharacter = characters[characterIndex - 1];
    const nextDelay = !isDeleting && typedCharacter === '\n' ? lineDelay : typeDelay;
    window.setTimeout(updateTypewriter, isDeleting ? deleteDelay : nextDelay);
  };

  typewriter.textContent = '';
  window.setTimeout(updateTypewriter, 420);
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
