const radians = (degrees) => degrees * Math.PI / 180;

export function cardExtents(card) {
  const angle = radians(card.angle);
  const cos = Math.abs(Math.cos(angle));
  const sin = Math.abs(Math.sin(angle));
  return {
    x: (card.width * cos + card.height * sin) / 2,
    y: (card.width * sin + card.height * cos) / 2,
  };
}

// Positions are card centers. Include rotated corners in all four wall tests.
export function containCard(card, arena, padding = 4) {
  const extents = cardExtents(card);
  for (const [axis, size, velocity] of [['x', 'width', 'vx'], ['y', 'height', 'vy']]) {
    const min = extents[axis] + padding;
    const max = arena[size] - extents[axis] - padding;
    if (max <= min) {
      card[axis] = arena[size] / 2;
    } else if (card[axis] <= min) {
      card[axis] = min;
      card[velocity] = Math.abs(card[velocity]);
    } else if (card[axis] >= max) {
      card[axis] = max;
      card[velocity] = -Math.abs(card[velocity]);
    }
  }
}


// SAT uses the actual tilted rectangles, with a small visible gap.
export function cardContact(a, b, gap = 8) {
  const axes = [a, b].flatMap(c => {
    const r = radians(c.angle);
    return [{x: Math.cos(r), y: Math.sin(r)}, {x: -Math.sin(r), y: Math.cos(r)}];
  });
  let contact = null;
  for (const n of axes) {
    const radius = c => {
      const r = radians(c.angle);
      return Math.abs(n.x * Math.cos(r) + n.y * Math.sin(r)) * c.width / 2
        + Math.abs(-n.x * Math.sin(r) + n.y * Math.cos(r)) * c.height / 2;
    };
    const distance = (b.x - a.x) * n.x + (b.y - a.y) * n.y;
    const depth = radius(a) + radius(b) + gap - Math.abs(distance);
    if (depth <= 0) return null;
    if (!contact || depth < contact.depth) {
      const sign = distance < 0 ? -1 : 1;
      contact = {x: n.x * sign, y: n.y * sign, depth};
    }
  }
  return contact;
}

export function resolveContacts(cards, arena) {
  for (let pass = 0; pass < 80; pass++) {
    let deepest = 0;
    for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
      const a = cards[i], b = cards[j], hit = cardContact(a, b);
      if (!hit) continue;
      deepest = Math.max(deepest, hit.depth);
      const correction = (hit.depth + 0.001) / 2;
      a.x -= hit.x * correction; a.y -= hit.y * correction;
      b.x += hit.x * correction; b.y += hit.y * correction;
      const closing = (a.vx - b.vx) * hit.x + (a.vy - b.vy) * hit.y;
      if (closing > 0) {
        a.vx -= closing * hit.x; a.vy -= closing * hit.y;
        b.vx += closing * hit.x; b.vy += closing * hit.y;
      }
    }
    cards.forEach(c => containCard(c, arena));
    if (deepest < 0.001) break;
  }
}

export function pushFromPointer(card, pointer, delta) {
  if (!pointer?.active || !delta) return;
  const r = radians(card.angle), cos = Math.cos(r), sin = Math.sin(r);
  const dx = pointer.x - card.x, dy = pointer.y - card.y;
  const localX = dx * cos + dy * sin, localY = -dx * sin + dy * cos;
  const edgeX = Math.max(-card.width / 2, Math.min(card.width / 2, localX));
  const edgeY = Math.max(-card.height / 2, Math.min(card.height / 2, localY));
  const distance = Math.hypot(localX - edgeX, localY - edgeY);
  const reach = 65;
  if (distance >= reach) return;
  const length = Math.hypot(dx, dy);
  const nx = length > 0.01 ? -dx / length : 1;
  const ny = length > 0.01 ? -dy / length : 0;
  const force = 240 * (1 - distance / reach) ** 2;
  card.vx += nx * force * delta;
  card.vy += ny * force * delta;
}

export function advanceCards(cards, arena, delta, elapsed, pointer) {
  // Small substeps keep fast pointer pushes from passing through another card.
  const steps = Math.max(1, Math.ceil(delta / (1 / 120)));
  const dt = delta / steps;
  for (let step = 0; step < steps; step++) {
    for (const card of cards) {
      card.angle = card.tilt + Math.sin(elapsed * 0.35 + card.phase) * 1.25;
      pushFromPointer(card, pointer, dt);
      const speed = Math.hypot(card.vx, card.vy);
      const cruising = card.cruiseSpeed ?? Math.hypot(11, 8);
      if (speed > cruising) {
        const next = Math.min(155, cruising + (speed - cruising) * Math.exp(-1.8 * dt));
        card.vx *= next / speed; card.vy *= next / speed;
      }
      card.x += card.vx * dt;
      card.y += card.vy * dt;
      containCard(card, arena);
    }
    resolveContacts(cards, arena);
  }
}
