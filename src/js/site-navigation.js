export function initSiteNavigation() {
  const button = document.querySelector('[data-menu-toggle]');
  const navigation = document.querySelector('[data-navigation]');
  if (!button || !navigation) return;
  const desktop = window.matchMedia('(min-width: 64.01rem)');
  const links = [...navigation.querySelectorAll('a[href]')];

  const setOpen = (open, restoreFocus = false) => {
    const isOpen = open && !desktop.matches;
    button.setAttribute('aria-expanded', String(isOpen));
    button.setAttribute('aria-label', isOpen ? 'Cerrar menú' : 'Abrir menú');
    navigation.classList.toggle('is-open', isOpen);
    document.body.classList.toggle('menu-open', isOpen);
    if (isOpen) window.requestAnimationFrame(() => {
      if (navigation.classList.contains('is-open')) links[0]?.focus({ preventScroll: true });
    });
    else if (restoreFocus) button.focus({ preventScroll: true });
  };

  button.addEventListener('click', () => setOpen(button.getAttribute('aria-expanded') !== 'true'));
  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });
  desktop.addEventListener('change', () => setOpen(false));
  window.addEventListener('pageshow', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (button.getAttribute('aria-expanded') !== 'true') return;
    if (event.key === 'Escape') setOpen(false, true);
    if (event.key !== 'Tab') return;
    const targets = [button, ...links];
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
}
