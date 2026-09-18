import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSectors,
  sectorIndexAtAngle,
  SPIN_AGAIN_LABEL,
  WHEEL_COLOR_1,
  WHEEL_COLOR_2,
  FRICTION,
  STOP_BELOW,
  SPIN_MIN_VELOCITY,
  SPIN_MAX_VELOCITY,
} from "../src/assets/js/wheel-logic.mjs";

const TAU = 2 * Math.PI;
const recipes = (n) =>
  Array.from({ length: n }, (_, i) => ({ label: `R${i}`, slug: `r${i}` }));

test("pads an odd number of recipes with a Spin Again sector", () => {
  // The wheel alternates two colours, so an odd count would put the same colour
  // either side of twelve o'clock.
  for (const n of [1, 3, 5, 7, 17]) {
    const sectors = buildSectors(recipes(n));
    assert.equal(sectors.length, n + 1, `${n} recipes -> ${n + 1} sectors`);
    assert.equal(sectors.at(-1).label, SPIN_AGAIN_LABEL);
    // It must go nowhere when clicked or landed on.
    assert.equal(sectors.at(-1).slug, undefined);
  }

  for (const n of [2, 4, 6, 8, 18]) {
    const sectors = buildSectors(recipes(n));
    assert.equal(sectors.length, n, `${n} recipes -> no padding`);
    assert.ok(sectors.every((s) => s.label !== SPIN_AGAIN_LABEL));
  }
});

test("alternates the two wheel colours, starting on blue", () => {
  const sectors = buildSectors(recipes(8));
  sectors.forEach((sector, i) => {
    assert.equal(sector.color, i % 2 === 0 ? WHEEL_COLOR_1 : WHEEL_COLOR_2);
  });
  // With padding applied the count is always even, so the last sector never
  // shares a colour with the first.
  assert.notEqual(sectors.at(0).color, sectors.at(-1).color);
});

test("carries each recipe's label and slug through", () => {
  const sectors = buildSectors([{ label: "Dal", slug: "dal" }]);
  assert.equal(sectors[0].label, "Dal");
  assert.equal(sectors[0].slug, "dal");
});

test("an empty recipe list makes no sectors", () => {
  // The wheel checks for this and declines to start rather than dividing by zero.
  assert.deepEqual(buildSectors([]), []);
});

test("the sector under an angle is the sector drawn there", () => {
  // Sweep every sector count the wheel could plausibly have, at every rotation,
  // and confirm the middle of each sector maps back to its own index.
  for (let n = 2; n <= 20; n++) {
    const arc = TAU / n;
    for (let i = 0; i < n; i++) {
      for (const rotation of [0, 0.5, 1, 2, -1, -3.7, TAU, 10 * TAU]) {
        // Screen angle of sector i's midpoint at this rotation.
        const screenAngle = rotation - Math.PI / 2 + (i + 0.5) * arc;
        assert.equal(
          sectorIndexAtAngle(screenAngle, rotation, n),
          i,
          `n=${n} i=${i} rotation=${rotation}`,
        );
      }
    }
  }
});

test("always returns an index that exists, including on sector borders", () => {
  // An exact border is where this went wrong before: normalising the angle
  // before dividing loses precision and can land one past the end.
  for (let n = 2; n <= 20; n++) {
    const arc = TAU / n;
    for (let i = 0; i <= n; i++) {
      for (const rotation of [0, 1, -1, 2.5, TAU]) {
        const border = rotation - Math.PI / 2 + i * arc;
        for (const angle of [border, border - 1e-12, border + 1e-12]) {
          const index = sectorIndexAtAngle(angle, rotation, n);
          assert.ok(
            Number.isInteger(index) && index >= 0 && index < n,
            `n=${n} i=${i} rotation=${rotation} gave ${index}`,
          );
        }
      }
    }
  }
});

test("the spin travels a whole number of turns, so no sector is favoured", () => {
  // A spin is one random starting velocity and then pure deceleration, so the
  // resting angle is decided entirely by that number. Wrapping the range of
  // travel onto a circle only comes out even if the range spans a whole number
  // of turns -- a fractional span leaves part of the wheel reachable from more
  // starting velocities than the rest, which is worth about a 14% bias.
  //
  // This models frame() in wheel.mjs: cut the velocity by friction, stop if it
  // fell below the threshold, otherwise add it to the angle.
  const distance = (startVelocity) => {
    let velocity = startVelocity;
    let total = 0;
    for (;;) {
      velocity *= FRICTION;
      if (velocity < STOP_BELOW) return total;
      total += velocity;
    }
  };

  const span =
    (distance(SPIN_MAX_VELOCITY) - distance(SPIN_MIN_VELOCITY)) / TAU;
  assert.ok(
    Math.abs(span - Math.round(span)) < 0.01,
    `travel spans ${span.toFixed(3)} turns; a fractional span biases the result`,
  );
  // And it should be a real spin, not a nudge.
  assert.ok(distance(SPIN_MIN_VELOCITY) / TAU > 2);
});
