import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// The corner decorations are rotated, so their bounding box is not where they
// actually are: the banner's left end sits high and its right end low. Checking
// this by eye is how the search bar ended up clipping it. This works out the real
// rotated quadrilaterals and the search bar's rectangle at a spread of viewport
// sizes, and asserts they never touch.
//
// Values are read from the stylesheet rather than copied, so retuning the layout
// there is enough -- nothing to keep in step here.

const CSS = fs.readFileSync("src/assets/css/wheel.css", "utf8");
const IMAGES = "src/assets/images/ui";

// Intrinsic size straight out of the PNG header: 8-byte signature, then the IHDR
// chunk's length and type, then width and height as big-endian 32-bit ints.
function pngSize(file) {
  const buffer = fs.readFileSync(`${IMAGES}/${file}`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function rule(selector) {
  const match = CSS.match(
    new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\}`),
  );
  assert.ok(match, `${selector} is missing from wheel.css`);
  return match[1];
}

// A declaration written as a single value with a unit, e.g. "top: 7.5vmin".
function value(selector, property) {
  const match = rule(selector).match(
    new RegExp(`(?:^|[;{\\s])${property}:\\s*(-?[\\d.]+)(px|rem|vmin|vw|vh)`),
  );
  assert.ok(match, `${selector} has no single-value ${property}`);
  return { amount: Number(match[1]), unit: match[2] };
}

// The clearance is zero by default and only applies below an aspect ratio, so the
// wheel keeps its full size on landscape screens where nothing can overlap.
function clearanceFor(vp) {
  const media = CSS.match(
    /@media \(max-aspect-ratio:\s*(\d+)\s*\/\s*(\d+)\)\s*\{\n([\s\S]*?)\n\}/,
  );
  assert.ok(media, "the aspect-ratio media query is missing from wheel.css");
  const threshold = Number(media[1]) / Number(media[2]);
  const override = media[3].match(/--corner-clearance:\s*([\d.]+)(vmin|vh|px)/);
  assert.ok(override, "the media query does not set --corner-clearance");

  return vp.width / vp.height <= threshold
    ? px({ amount: Number(override[1]), unit: override[2] }, vp)
    : px(value(".center", "--corner-clearance"), vp);
}

// Below a certain viewport height the personal-site image is dropped and the
// wheel gets its space back. The test has to know, or its model stops describing
// the page.
function shortViewport(vp) {
  const media = CSS.match(
    /@media \(max-height:\s*(\d+)px\)\s*\{\n([\s\S]*?)\n\}/,
  );
  assert.ok(media, "the short-viewport media query is missing from wheel.css");
  const applies = vp.height <= Number(media[1]);
  const reserve = media[2].match(/--wheel-reserve:\s*([\d.]+)(rem|px)/);
  assert.ok(reserve, "the media query should hand back the reserved space");
  assert.match(
    media[2],
    /\.personal_site\s*\{[^}]*display:\s*none/,
    "the media query should hide the personal-site image",
  );
  return {
    applies,
    reserve: applies
      ? px({ amount: Number(reserve[1]), unit: reserve[2] }, vp)
      : null,
  };
}

function degrees(selector) {
  const match = rule(selector).match(/rotate\((-?[\d.]+)deg\)/);
  assert.ok(match, `${selector} has no rotation`);
  return Number(match[1]);
}

// Resolve a CSS length against a viewport.
const px = ({ amount, unit }, vp) =>
  ({
    px: amount,
    rem: amount * 16,
    vw: (amount / 100) * vp.width,
    vh: (amount / 100) * vp.height,
    vmin: (amount / 100) * Math.min(vp.width, vp.height),
  })[unit];

// The four corners of an element after rotating about its centre. CSS rotates
// clockwise and screen y grows downward.
function rotatedCorners({ x, y, width, height }, deg) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = x + width / 2;
  const cy = y + height / 2;
  return [
    [-width / 2, -height / 2],
    [width / 2, -height / 2],
    [width / 2, height / 2],
    [-width / 2, height / 2],
  ].map(([dx, dy]) => [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]);
}

const rectCorners = ({ x, y, width, height }) => [
  [x, y],
  [x + width, y],
  [x + width, y + height],
  [x, y + height],
];

// Separating-axis test: two convex polygons miss each other exactly when some
// edge normal separates their projections.
function overlaps(a, b) {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i++) {
      const [x1, y1] = polygon[i];
      const [x2, y2] = polygon[(i + 1) % polygon.length];
      const axis = [-(y2 - y1), x2 - x1];
      const project = (poly) => {
        const dots = poly.map(([x, y]) => x * axis[0] + y * axis[1]);
        return [Math.min(...dots), Math.max(...dots)];
      };
      const [aMin, aMax] = project(a);
      const [bMin, bMax] = project(b);
      if (aMax <= bMin || bMax <= aMin) return false;
    }
  }
  return true;
}

// Rebuild the wheel page's layout arithmetic for one viewport.
function layout(vp) {
  const vmin = Math.min(vp.width, vp.height);
  const L = (v) => px(v, vp);

  const corner = (selector, image, side) => {
    const size = pngSize(image);
    const width = L(value(selector, "width"));
    const height = width * (size.height / size.width);
    const offset = L(value(selector, side));
    return rotatedCorners(
      {
        x: side === "left" ? offset : vp.width - offset - width,
        y: L(value(selector, "top")),
        width,
        height,
      },
      degrees(selector),
    );
  };

  const searchImage = pngSize("search.png");
  const searchWidth = Math.min(
    L(value(".search", "--search-max-width")),
    L(value(".search", "--search-viewport-width")),
    Math.max(
      L(value(".search", "--search-min-width")),
      vp.width - L(value(".search", "--search-corner-reach")),
    ),
  );
  const searchHeight = searchWidth * (searchImage.height / searchImage.width);

  const clearance = clearanceFor(vp);
  const gap = L(value(".center", "--stack-gap"));
  const short = shortViewport(vp);
  const wheel = Math.min(
    0.8 * vmin,
    vp.height -
      clearance -
      (short.reserve ?? L(value("#spinner_wheel", "--wheel-reserve"))),
  );

  // The personal-site image sits under the wheel, so it is part of the stack and
  // pushes everything above it upward -- including the search bar, back towards
  // the corner decorations. On a short viewport it is hidden and contributes
  // nothing, not even a gap.
  const siteImage = pngSize("personal_website.png");
  const siteWidth = Math.min(
    L(value(".personal_site", "--personal-site-width")),
    vp.width / 2,
  );
  const siteHeight = short.applies
    ? 0
    : siteWidth * (siteImage.height / siteImage.width);

  // Flex column, centred in what is left below the top padding.
  const stack =
    searchHeight + gap + wheel + (short.applies ? 0 : gap + siteHeight);
  const top = clearance + Math.max(0, (vp.height - clearance - stack) / 2);

  return {
    searchBar: rectCorners({
      x: (vp.width - searchWidth) / 2,
      y: top,
      width: searchWidth,
      height: searchHeight,
    }),
    heart: corner(".corner_left", "heart-c-plus-e.png", "left"),
    banner: corner(".corner_right", "no-decisions-required.png", "right"),
    wheel,
    stackBottom: top + stack,
  };
}

// A sweep, not a list of popular devices. A hand-picked set of twenty sizes
// passed while a band of small landscape windows around 520-600px wide still
// clipped the banner -- the sampling was the bug. Every window shape someone can
// drag to is worth checking, so this walks the whole space.
const VIEWPORTS = [];
for (let width = 300; width <= 2560; width += 20) {
  for (let height = 380; height <= 1600; height += 20) {
    VIEWPORTS.push({ width, height });
  }
}

// Reported compactly: a thousand failures listed one per line helps nobody.
function report(clashes) {
  if (!clashes.length) return "";
  const shown = clashes.slice(0, 8).join(", ");
  return `${clashes.length} of ${VIEWPORTS.length} viewport sizes fail, e.g. ${shown}`;
}

test("the search bar never touches the corner decorations", () => {
  const clashes = [];
  for (const vp of VIEWPORTS) {
    const { searchBar, heart, banner } = layout(vp);
    if (overlaps(searchBar, banner))
      clashes.push(`${vp.width}x${vp.height} banner`);
    else if (overlaps(searchBar, heart))
      clashes.push(`${vp.width}x${vp.height} heart`);
  }
  assert.equal(clashes.length, 0, report(clashes));
});

test("the corner decorations stay on screen", () => {
  // The offsets have to grow with the images, since rotating about the centre
  // makes the rendered box wider than the image itself.
  for (const vp of VIEWPORTS) {
    const { heart, banner } = layout(vp);
    for (const [name, polygon] of [
      ["heart", heart],
      ["banner", banner],
    ]) {
      const xs = polygon.map(([x]) => x);
      assert.ok(
        Math.min(...xs) >= 0,
        `${name} is clipped off the left at ${vp.width}x${vp.height}`,
      );
      assert.ok(
        Math.max(...xs) <= vp.width,
        `${name} is clipped off the right at ${vp.width}x${vp.height}`,
      );
      assert.ok(
        Math.min(...polygon.map(([, y]) => y)) >= 0,
        `${name} is clipped off the top at ${vp.width}x${vp.height}`,
      );
    }
  }
});

test("the page never needs a scrollbar", () => {
  // The wheel and the scrollbar have history: a page taller than the viewport is
  // what made the wheel jitter and rescale mid-spin.
  for (const vp of VIEWPORTS) {
    const { stackBottom } = layout(vp);
    assert.ok(
      stackBottom <= vp.height + 0.5,
      `content runs ${(stackBottom - vp.height).toFixed(0)}px past the bottom at ${vp.width}x${vp.height}`,
    );
  }
});

test("the wheel stays a usable size", () => {
  // Clearing the corners costs the wheel some room; this is the floor on how
  // much, so a future clearance bump can't quietly shrink it to nothing.
  for (const vp of VIEWPORTS) {
    const { wheel } = layout(vp);
    const shortest = Math.min(vp.width, vp.height);
    assert.ok(
      wheel >= 0.42 * shortest,
      `wheel is only ${Math.round(wheel)}px (${Math.round((wheel / shortest) * 100)}% of the short side) at ${vp.width}x${vp.height}`,
    );
  }
});
