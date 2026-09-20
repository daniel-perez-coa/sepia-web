import '../scss/main.scss';
import 'bootstrap-icons/font/bootstrap-icons.css';
import { initCatalog } from './catalog.js';
import { siteConfig } from './site-config.js';
import { syncCartCount } from './cart-store.js';
import { initHeroCards } from './hero-cards.js';
import { initSiteNavigation } from './site-navigation.js';

document.documentElement.classList.add('js');
syncCartCount();
const disposeHeroCards = initHeroCards();
if (import.meta.hot) import.meta.hot.dispose(() => disposeHeroCards?.());

const catalogReady = initCatalog();
const scrollStorageKey = `sepia-scroll:${window.location.pathname}`;
let scrollSaveFrame = 0;
window.addEventListener('scroll', () => {
  if (scrollSaveFrame) return;
  scrollSaveFrame = window.requestAnimationFrame(() => {
    sessionStorage.setItem(scrollStorageKey, String(window.scrollY));
    scrollSaveFrame = 0;
  });
}, { passive: true });

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const createIcon = (name) => {
  const icon = document.createElement('i');
  icon.className = `bi bi-${name}`;
  icon.setAttribute('aria-hidden', 'true');
  return icon;
};

const header = document.querySelector('[data-header]');
const pageViews = [...document.querySelectorAll('[data-page-view]')];
initSiteNavigation();

const returnTopLinks = [...document.querySelectorAll('[data-return-top]')];
// Every data-page-view section automatically joins the full-page navigation flow.
const fullPageNavigation = window.matchMedia('(min-width: 64.01rem) and (min-height: 44rem)');

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
  const headerMode = fullPageNavigation.matches ? activeView.dataset.headerMode ?? 'default' : 'default';
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
  window.scrollTo({
    top: Math.max(0, nextView.offsetTop - (fullPageNavigation.matches || nextIndex === 0 ? 0 : header?.offsetHeight ?? 0)),
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });

  window.clearTimeout(navigationUnlockTimer);
  navigationUnlockTimer = window.setTimeout(() => {
    navigationLocked = false;
  }, prefersReducedMotion ? 80 : 900);
};

const restoreSavedScroll = () => {
  const hashTarget = window.location.hash ? document.querySelector(window.location.hash) : null;
  if (window.location.hash && hashTarget) {
    window.scrollTo({ top: Math.max(0, hashTarget.offsetTop - (fullPageNavigation.matches || hashTarget.id === 'inicio' ? 0 : header?.offsetHeight ?? 0)), left: 0, behavior: 'auto' });
    return;
  }

  const savedScroll = Number(sessionStorage.getItem(scrollStorageKey));
  if (Number.isFinite(savedScroll) && sessionStorage.getItem(scrollStorageKey) !== null) {
    window.scrollTo({ top: savedScroll, left: 0, behavior: 'auto' });
    return;
  }

  const defaultTarget = document.querySelector('#inicio');
  if (defaultTarget) defaultTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
};

const handleWheelNavigation = (event) => {
  if (!fullPageNavigation.matches || document.body.classList.contains('menu-open')) return;
  if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  // Tall sections must be readable before advancing to the next section.
  const bounds = pageViews[activeViewIndex]?.getBoundingClientRect();
  if (bounds && (event.deltaY > 0 && bounds.bottom > window.innerHeight + 2
    || event.deltaY < 0 && bounds.top < -2)) return;

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

  const bounds = pageViews[activeViewIndex]?.getBoundingClientRect();
  if (event.key !== 'Home' && bounds && (forward && bounds.bottom > window.innerHeight + 2
    || backward && bounds.top < -2)) return;

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
  const passedHref = emailLink.getAttribute('href') || '';
  const passedLabel = emailLink.textContent.trim();
  const hasPassedEmail = passedHref.startsWith('mailto:');

  if (!hasPassedEmail) {
    emailLink.href = `mailto:${siteConfig.contact.email}`;
  }

  if (!passedLabel) {
    emailLink.textContent = siteConfig.contact.email;
    emailLink.append(createIcon('arrow-up-right'));
  }
}

document.querySelectorAll('[data-social]').forEach((link) => {
  const social = siteConfig.socials[link.dataset.social];
  if (!social) return;
  link.href = link.dataset.socialUrl || social.url;
  const label = link.querySelector('[data-social-label]');
  if (label) {
    label.textContent = link.dataset.socialHandle || social.label;
    label.append(createIcon('arrow-up-right'));
  }
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

catalogReady.finally(() => {
  restoreSavedScroll();
  document.body.classList.add('is-ready');
});
