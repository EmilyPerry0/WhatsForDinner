// The wheel's pure logic and its tunable constants, kept apart from wheel.mjs so
// the tests can import them — wheel.mjs takes hold of a canvas the moment it
// loads, which no test environment can provide.

export const TEXT_COLOR = "#3D3750";
export const WHEEL_COLOR_1 = "#5DC0EC";
export const WHEEL_COLOR_2 = "#F57AC5";

export const SPIN_AGAIN_LABEL = "Spin Again!";

// Spin physics. A spin is one random starting velocity and then pure
// deceleration, so these four numbers decide entirely where the wheel stops.
export const FRICTION = 0.991; // 0.995=soft, 0.99=mid, 0.98=hard
export const STOP_BELOW = 0.002; // velocity at which the wheel is called stopped
// The gap between these two is a whole number of turns on purpose. Wrapping a
// range that spans a fractional number of turns onto a circle leaves part of the
// wheel reachable by more starting velocities than the rest, which biases the
// result by about ±14%. test/wheel-logic.test.mjs pins the property.
export const SPIN_MIN_VELOCITY = 0.25;
export const SPIN_MAX_VELOCITY = 0.478263;

const TAU = 2 * Math.PI;

// Turn the recipe list into drawable sectors: alternate the two wheel colors, and
// pad with a "Spin Again" sector when the count is odd.
export function buildSectors(recipes) {
  const entries = recipes.map((r) => ({ label: r.label, slug: r.slug }));
  if (entries.length % 2 !== 0) {
    entries.push({ label: SPIN_AGAIN_LABEL });
  }
  return entries.map((entry, i) => ({
    ...entry,
    color: i % 2 === 0 ? WHEEL_COLOR_1 : WHEEL_COLOR_2,
    text: TEXT_COLOR,
  }));
}

// Which sector sits at a given screen angle. The spin applies a CSS rotation to
// the canvas, so screen angles and wheel angles differ by exactly that rotation.
// Scaling to sector units before flooring, rather than normalising the angle
// first, is what keeps this exact for an angle landing on a sector border.
export function sectorIndexAtAngle(screenAngle, wheelRotation, sectorCount) {
  const wheelAngle = screenAngle - (wheelRotation - Math.PI / 2);
  const index = Math.floor((wheelAngle / TAU) * sectorCount);
  return ((index % sectorCount) + sectorCount) % sectorCount;
}
