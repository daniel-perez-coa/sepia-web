import { advanceCards, cardExtents, containCard } from './hero-card-physics.js';

export function initHeroCards() {
  const container = document.querySelector('.hero__visual');
  const elements = [...(container?.querySelectorAll('.hero-card') ?? [])];
  if (!elements.length) return;

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const visualLayout = window.matchMedia('(min-width: 52rem)');
  const arena = { width: 0, height: 0 };
  const tilts = [-6, 3.5, 6];
  const velocities = [[11, 8], [-9, 11], [10, -9]];
  const cards = elements.map((element, index) => ({
    element,
    x: 0, y: 0, width: 0, height: 0,
    vx: 0, vy: 0,
    tilt: tilts[index], angle: tilts[index], phase: index * 2.1,
  }));
  let frame = 0;
  let previousTime = 0;
  let elapsed = 0;
  let visible = false;
  const pointer = { active: false, x: 0, y: 0 };
  const trackPointer = (event) => {
    if (event.pointerType === 'touch' || motionPreference.matches) return;
    const rect = container.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.active = true;
  };
  const clearPointer = () => { pointer.active = false; };
  container.addEventListener('pointermove', trackPointer, { passive: true });
  container.addEventListener('pointerleave', clearPointer);
  container.addEventListener('pointercancel', clearPointer);
  window.addEventListener('blur', clearPointer);
  window.addEventListener('scroll', clearPointer, { passive: true });

  const render = () => {
    cards.forEach((card) => {
      card.element.style.transform = `translate3d(${card.x - card.width / 2}px, ${card.y - card.height / 2}px, 0) rotate(${card.angle}deg)`;
    });
  };

  const tick = (time) => {
    const delta = previousTime ? Math.min((time - previousTime) / 1000, 0.04) : 0;
    previousTime = time;
    elapsed += delta;
    advanceCards(cards, arena, delta, elapsed, pointer);
    render();
    frame = window.requestAnimationFrame(tick);
  };

  const syncAnimation = () => {
    window.cancelAnimationFrame(frame);
    frame = 0;
    previousTime = 0;
    clearPointer();
    const moving = visualLayout.matches && !motionPreference.matches && !document.hidden && visible;
    container.toggleAttribute('data-cards-moving', moving);
    if (moving) frame = window.requestAnimationFrame(tick);
  };

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height || width === arena.width && height === arena.height) return;
    clearPointer();
    arena.width = width;
    arena.height = height;
    const horizontal = width / height > 1.35;
    // One shared size, with enough room for three cards and their tilted corners.
    const cardWidth = Math.min(264, width * (horizontal ? 0.27 : 0.41), height * (horizontal ? 0.6 : 0.39) * 27 / 37);
    container.style.setProperty('--hero-card-width', `${cardWidth}px`);
    const starts = horizontal
      ? [[0.02, 0.25], [0.5, 0.5], [0.98, 0.75]]
      : [[0.04, 0.03], [0.96, 0.49], [0.28, 0.97]];

    cards.forEach((card, index) => {
      card.width = cardWidth;
      card.height = cardWidth * 37 / 27;
      const extents = cardExtents(card);
      const start = starts[index];
      card.x = extents.x + 4 + (width - 2 * extents.x - 8) * start[0];
      card.y = extents.y + 4 + (height - 2 * extents.y - 8) * start[1];
      const speedScale = Math.min(1, cardWidth / 230);
      card.vx = velocities[index][0] * speedScale;
      card.vy = velocities[index][1] * speedScale;
      card.cruiseSpeed = Math.hypot(card.vx, card.vy);
      containCard(card, arena);
    });
    advanceCards(cards, arena, 0, elapsed);
    render();
  };

  // The inline transform owns positioning even while motion is paused.
  container.setAttribute('data-cards-ready', '');
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const visibilityObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    syncAnimation();
  });
  visibilityObserver.observe(container);
  motionPreference.addEventListener('change', syncAnimation);
  visualLayout.addEventListener('change', syncAnimation);
  document.addEventListener('visibilitychange', syncAnimation);
  resize();

  return () => {
    window.cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    visibilityObserver.disconnect();
    motionPreference.removeEventListener('change', syncAnimation);
    visualLayout.removeEventListener('change', syncAnimation);
    document.removeEventListener('visibilitychange', syncAnimation);
    container.removeEventListener('pointermove', trackPointer);
    container.removeEventListener('pointerleave', clearPointer);
    container.removeEventListener('pointercancel', clearPointer);
    window.removeEventListener('blur', clearPointer);
    window.removeEventListener('scroll', clearPointer);
    container.removeAttribute('data-cards-moving');
    container.removeAttribute('data-cards-ready');
    container.style.removeProperty('--hero-card-width');
    elements.forEach((element) => element.style.removeProperty('transform'));
  };
}
