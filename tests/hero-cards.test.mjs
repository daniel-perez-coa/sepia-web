import assert from 'node:assert/strict';
import test from 'node:test';
import { advanceCards, cardExtents, containCard, cardContact, pushFromPointer } from '../src/js/hero-card-physics.js';

const makeCard = (overrides = {}) => ({
  width: 180, height: 180 * 37 / 27,
  x: 250, y: 350, vx: 11, vy: 8,
  angle: -6, tilt: -6, phase: 0,
  ...overrides,
});

test('all rotated corners stay inside the walls and reflect the approaching velocity', () => {
  const arena = { width: 600, height: 800 };
  for (const angle of [-7.25, 0, 7.25]) {
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      const card = makeCard({ angle });
      if (edge === 'left') Object.assign(card, { x: 0, vx: -11 });
      if (edge === 'right') Object.assign(card, { x: 600, vx: 11 });
      if (edge === 'top') Object.assign(card, { y: 0, vy: -8 });
      if (edge === 'bottom') Object.assign(card, { y: 800, vy: 8 });
      containCard(card, arena);
      const extents = cardExtents(card);
      assert.ok(card.x - extents.x >= 4 - 1e-9);
      assert.ok(card.x + extents.x <= 596 + 1e-9);
      assert.ok(card.y - extents.y >= 4 - 1e-9);
      assert.ok(card.y + extents.y <= 796 + 1e-9);
      if (edge === 'left') assert.ok(card.vx > 0);
      if (edge === 'right') assert.ok(card.vx < 0);
      if (edge === 'top') assert.ok(card.vy > 0);
      if (edge === 'bottom') assert.ok(card.vy < 0);
    }
  }
});

test('movement uses elapsed time instead of the display refresh rate', () => {
  const simulate = (fps) => {
    const card = makeCard();
    for (let frame = 1; frame <= fps * 2; frame += 1) {
      advanceCards([card], { width: 900, height: 900 }, 1 / fps, frame / fps);
    }
    return card;
  };
  const slowDisplay = simulate(30);
  const fastDisplay = simulate(144);
  assert.ok(Math.abs(slowDisplay.x - fastDisplay.x) < 1e-8);
  assert.ok(Math.abs(slowDisplay.y - fastDisplay.y) < 1e-8);
  assert.equal(slowDisplay.angle, fastDisplay.angle);
});

test('cards stay separated and contained during pointer pushes on mobile and desktop', () => {
  for (const arena of [{ width: 343, height: 464 }, { width: 627, height: 904 }]) {
    const width = Math.min(264, arena.width * 0.41, arena.height * 0.39 * 27 / 37);
    const cards = [
      makeCard({ width, height: width * 37 / 27, x: width / 2 + 24, y: width * 0.8 }),
      makeCard({ width, height: width * 37 / 27, x: arena.width - width / 2 - 24, y: arena.height / 2, vx: -9, vy: 11, angle: 3.5, tilt: 3.5, phase: 2.1 }),
      makeCard({ width, height: width * 37 / 27, x: arena.width * 0.35, y: arena.height - width * 0.8, vx: 10, vy: -9, angle: 6, tilt: 6, phase: 4.2 }),
    ];

    for (let frame = 0; frame < 60 * 300; frame += 1) {
      advanceCards(cards, arena, 1 / 60, frame / 60, {active: frame % 600 < 180, x: arena.width * (0.5 + 0.45 * Math.sin(frame / 230)), y: arena.height * (0.5 + 0.45 * Math.cos(frame / 310))});
      for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
        assert.equal(cardContact(cards[i], cards[j], 0), null, 'rotated cards must never overlap');
      }
      for (const [index, card] of cards.entries()) {
        const extents = cardExtents(card);
        assert.ok(card.x - extents.x >= 4 - 1e-8);
        assert.ok(card.y - extents.y >= 4 - 1e-8);
        assert.ok(card.x + extents.x <= arena.width - 4 + 1e-8);
        assert.ok(card.y + extents.y <= arena.height - 4 + 1e-8);
      }
    }
  }
});


test('pointer repels cards from both sides and ignores distant or inactive pointers', () => {
  for (const side of [-1, 1]) {
    const c = makeCard({vx: 0, vy: 0});
    pushFromPointer(c, {active:true, x:c.x + side * 80, y:c.y}, 1/60);
    assert.ok(c.vx * side < 0);
  }
  const c = makeCard();
  pushFromPointer(c, {active:true, x:2000, y:2000}, 1/60);
  pushFromPointer(c, {active:false, x:c.x, y:c.y}, 1/60);
  assert.equal(c.vx, 11); assert.equal(c.vy, 8);
});
