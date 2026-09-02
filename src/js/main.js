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

const returnTopLinks = [...document.querySelectorAll('[data-return-top]')];
// Every data-page-view section automatically joins the full-page navigation flow.
const fullPageNavigation = window.matchMedia('(min-width: 60.01rem) and (min-height: 36rem)');

let activeViewIndex = 0;
let navigationLocked = false;
let wheelDelta = 0;
let wheelResetTimer;
let navigationUnlockTimer;

const getClosestViewIndex = () => pageViews.reduce((closestIndex, view, index) => {
  const currentDistance = Math.abs(pageViews[closestIndex].getBoundingClientRect().top);
  const nextDistance = Math.abs(view.getBoundingClientRect().top);
  return nextDistance < currentDistance ? index : closestIndex;
}, 0);

const syncViewState = (index) => {
  const activeView = pageViews[index];
  if (!activeView) return;

  activeViewIndex = index;
  const headerMode = activeView.dataset.headerMode ?? 'default';
  document.body.dataset.activeView = activeView.id || `view-${index + 1}`;
  header?.classList.toggle('is-scrolled', headerMode === 'default' && window.scrollY > 24);
  header?.classList.toggle('is-section-view', headerMode === 'signal');
  header?.classList.toggle('is-hidden', headerMode === 'hidden');
  returnTopLinks.forEach((link) => {
    link.classList.toggle('is-visible', link.dataset.returnView === activeView.id);
  });
};

const navigateToView = (index) => {
  const nextIndex = Math.max(0, Math.min(index, pageViews.length - 1));
  const nextView = pageViews[nextIndex];
  if (!nextView || nextIndex === activeViewIndex && Math.abs(nextView.getBoundingClientRect().top) < 2) return;

  navigationLocked = true;
  wheelDelta = 0;
  syncViewState(nextIndex);
  nextView.scrollIntoView({
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
    block: 'start',
  });

  window.clearTimeout(navigationUnlockTimer);
  navigationUnlockTimer = window.setTimeout(() => {
    navigationLocked = false;
  }, prefersReducedMotion ? 80 : 900);
};

const handleWheelNavigation = (event) => {
  if (!fullPageNavigation.matches || document.body.classList.contains('menu-open')) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  event.preventDefault();
  if (navigationLocked) return;

  wheelDelta += event.deltaY;
  window.clearTimeout(wheelResetTimer);
  wheelResetTimer = window.setTimeout(() => {
    wheelDelta = 0;
  }, 140);

  if (Math.abs(wheelDelta) < 48) return;
  navigateToView(activeViewIndex + Math.sign(wheelDelta));
};

const viewObserver = new IntersectionObserver((entries) => {
  if (navigationLocked) return;
  const visibleEntry = entries
    .filter((entry) => entry.isIntersecting)
    .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];
  if (!visibleEntry) return;
  syncViewState(pageViews.indexOf(visibleEntry.target));
}, { threshold: [0.35, 0.5, 0.65, 0.8] });

pageViews.forEach((view) => viewObserver.observe(view));
syncViewState(getClosestViewIndex());
window.addEventListener('wheel', handleWheelNavigation, { passive: false });
window.addEventListener('resize', () => syncViewState(getClosestViewIndex()), { passive: true });

document.addEventListener('keydown', (event) => {
  if (!fullPageNavigation.matches || navigationLocked) return;
  if (event.target.closest('input, textarea, select, button, [contenteditable="true"]')) return;

  const forward = event.key === 'PageDown' || event.key === 'ArrowDown' || event.key === ' ';
  const backward = event.key === 'PageUp' || event.key === 'ArrowUp' || event.key === 'Home';
  if (!forward && !backward) return;

  event.preventDefault();
  navigateToView(event.key === 'Home' ? 0 : activeViewIndex + (forward ? 1 : -1));
});

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link) return;
  const target = document.querySelector(link.getAttribute('href'));
  const targetIndex = pageViews.indexOf(target);
  if (targetIndex < 0) return;

  event.preventDefault();
  navigateToView(targetIndex);
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
