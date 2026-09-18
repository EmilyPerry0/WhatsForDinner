import {
  buildSectors,
  sectorIndexAtAngle as sectorIndexFor,
  FRICTION,
  STOP_BELOW,
  SPIN_MIN_VELOCITY,
  SPIN_MAX_VELOCITY,
} from "./wheel-logic.mjs";

const LABEL_EDGE_PADDING = 10; // gap between a label and the wheel's rim
const LABEL_HUB_GAP = 8; // gap between a label and the SPIN button
const MIN_LABEL_SIZE = 8; // don't shrink a long label past legibility

// Built from recipe-index.json once it loads (see init).
let sectors = [];

const rand = (m, M) => Math.random() * (M - m) + m;
const spinEl = document.querySelector("#spin_button");
const canvas = document.querySelector("#wheel");
const ctx = document.querySelector("#wheel").getContext("2d");
let dia = ctx.canvas.width;
let rad = dia / 2;
let hubRad = 0; // radius of the SPIN button at the centre, measured on resize
let lastSize = 0; // last size/dpr the canvas was built at, so a resize event
let lastDpr = 0; // that changes neither can skip the work
const PI = Math.PI;
const TAU = 2 * PI;
let arc = 0;

let angVel = 0; // Angular velocity
let ang = 0; // Angle in radians

let spinButtonClicked = false;

// Current rotation and sector count come from this module's state; the maths
// itself lives in wheel-logic.mjs.
const sectorIndexAtAngle = (screenAngle) =>
  sectorIndexFor(screenAngle, ang, sectors.length);

// The arrow sits at the top of the wheel.
const getIndex = () => sectorIndexAtAngle(-PI / 2);

function openRecipe(sector) {
  // The "Spin Again" sector has no slug, so it goes nowhere.
  if (sector && sector.slug) {
    window.location.href = `recipes/${sector.slug}/`;
  }
}

function handleWheelClick(event) {
  if (angVel) return; // don't act on a moving target

  // The rotation inflates the element's bounding rect but keeps its centre put,
  // so the centre is safe to take from the rect even mid-spin.
  const rect = canvas.getBoundingClientRect();
  const dx = event.clientX - (rect.left + rect.width / 2);
  const dy = event.clientY - (rect.top + rect.height / 2);

  // offsetWidth, not the rect's width: layout width ignores the rotation.
  if (Math.hypot(dx, dy) > canvas.offsetWidth / 2) return;

  openRecipe(sectors[sectorIndexAtAngle(Math.atan2(dy, dx))]);
}

// A canvas doesn't inherit the page's font, so it has to be told. Taking it from
// the stylesheet rather than naming a typeface here keeps the sector labels on
// whatever the rest of the site is set in, with no second copy to drift. Read
// once: it can't change, and fitLabel asks for it on every step of its measuring
// loop.
const pageFont = getComputedStyle(document.body).fontFamily;
const labelFont = (size) => `bold ${size}px ${pageFont}`;

// Labels are drawn inward from the rim, so a long one runs under the SPIN button
// at the hub. Shrink it just enough to fit the space between rim and button.
// Sets ctx.font as a side effect of measuring, so callers get the right font.
function fitLabel(label) {
  const available = rad - LABEL_EDGE_PADDING - hubRad - LABEL_HUB_GAP;

  // Step down a point at a time rather than scaling by a ratio: font metrics
  // aren't perfectly linear in the size, so measuring is what actually fits.
  let size = Math.max(12, rad * 0.075);
  ctx.font = labelFont(size);
  while (ctx.measureText(label).width > available && size > MIN_LABEL_SIZE) {
    size -= 1;
    ctx.font = labelFont(size);
  }
}

function drawSector(sector, i) {
  const ang = arc * i;
  ctx.save();

  // COLOR
  ctx.beginPath();
  ctx.fillStyle = sector.color;
  ctx.moveTo(rad, rad);
  ctx.arc(rad, rad, rad, ang, ang + arc);
  ctx.lineTo(rad, rad);
  ctx.fill();

  // TEXT
  ctx.translate(rad, rad);
  ctx.rotate(ang + arc / 2);
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  ctx.fillStyle = sector.text;
  fitLabel(sector.label);

  // Centre the label's ink on the sector's bisector, which the rotate above put
  // at y=0. Two things to get right: drawing at any other y sits on a line
  // parallel to the bisector rather than along it, which skews the label towards
  // one border near the hub; and "middle" centres the em box, which is a couple
  // of pixels off the ink for a label with no descender — enough to show as a
  // few degrees once the label reaches in towards the centre.
  const metrics = ctx.measureText(sector.label);
  const inkOffset =
    (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
  ctx.fillText(sector.label, rad - LABEL_EDGE_PADDING, inkOffset);

  ctx.restore();
}

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  sectors.forEach(drawSector);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  // offsetWidth/Height rather than the bounding rect: once a spin has rotated
  // the canvas, the rect is the inflated box around the rotated square, so a
  // resize after a spin would size the wheel from the wrong number.
  const size = canvas.offsetWidth;

  // A resize event doesn't mean the wheel changed size. Reassigning canvas.width
  // below clears and re-rasterises it, so reacting to every event makes the wheel
  // visibly rescale while a phone fires resizes mid-spin.
  if (size === lastSize && dpr === lastDpr) return;
  lastSize = size;
  lastDpr = dpr;

  canvas.width = size * dpr;
  canvas.height = canvas.offsetHeight * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scaling before reapplying
  ctx.scale(dpr, dpr);

  // Recalculate dia/rad based on CSS size, not the scaled buffer size
  dia = size;
  rad = dia / 2;
  hubRad = spinEl.getBoundingClientRect().width / 2;

  drawWheel();
}

function rotate() {
  const sector = sectors[getIndex()];
  ctx.canvas.style.transform = `rotate(${ang - PI / 2}rad)`;
  spinEl.style.background = sector.color;
  spinEl.style.color = sector.text;
}

function frame() {
  if (!angVel && spinButtonClicked) {
    spinButtonClicked = false;
    const sector = sectors[getIndex()];
    setTimeout(() => openRecipe(sector), 1000);
  }

  angVel *= FRICTION; // Decrement velocity by friction
  if (angVel < STOP_BELOW) angVel = 0; // Bring to stop
  ang += angVel; // Update angle
  ang %= TAU; // Normalize angle
  rotate();
}

function engine() {
  frame();
  requestAnimationFrame(engine);
}

function init() {
  window.addEventListener("resize", resizeCanvas);

  // recipe-index.json is generated at build time from src/recipes/*.md, so
  // adding a recipe file adds its sector to the wheel automatically.
  fetch("recipe-index.json")
    .then((res) => (res.ok ? res.json() : []))
    .then((recipes) => {
      sectors = buildSectors(recipes);
      if (!sectors.length) return;

      arc = TAU / sectors.length;
      resizeCanvas(); // set initial size + draw
      engine(); // Start engine
      spinEl.addEventListener("click", () => {
        if (!angVel) angVel = rand(SPIN_MIN_VELOCITY, SPIN_MAX_VELOCITY);
        spinButtonClicked = true;
      });
      canvas.addEventListener("click", handleWheelClick);
    })
    .catch(() => {});
}

init();
