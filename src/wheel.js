const textColor = "#3D3750";
const wheelBackgroundColor_1 = "#5DC0EC";
const wheelBackgroundColor_2 = "#F57AC5";

const SPIN_AGAIN_LABEL = "Spin Again!";

const LABEL_EDGE_PADDING = 10; // gap between a label and the wheel's rim
const LABEL_HUB_GAP = 8; // gap between a label and the SPIN button
const MIN_LABEL_SIZE = 8; // don't shrink a long label past legibility

// Built from recipe-index.json once it loads (see init).
let sectors = [];

// Turn the recipe list into drawable sectors: alternate the two wheel colors, and
// pad with a "Spin Again" sector when the count is odd.
function buildSectors(recipes) {
  const entries = recipes.map((r) => ({ label: r.label, slug: r.slug }));
  if (entries.length % 2 !== 0) {
    entries.push({ label: SPIN_AGAIN_LABEL });
  }
  return entries.map((entry, i) => ({
    ...entry,
    color: i % 2 === 0 ? wheelBackgroundColor_1 : wheelBackgroundColor_2,
    text: textColor,
  }));
}

const rand = (m, M) => Math.random() * (M - m) + m;
const spinEl = document.querySelector("#spin_button");
const canvas = document.querySelector("#wheel");
const ctx = document.querySelector("#wheel").getContext("2d");
let dia = ctx.canvas.width;
let rad = dia / 2;
let hubRad = 0; // radius of the SPIN button at the centre, measured on resize
const PI = Math.PI;
const TAU = 2 * PI;
let arc = 0;

const friction = 0.991; // 0.995=soft, 0.99=mid, 0.98=hard
let angVel = 0; // Angular velocity
let ang = 0; // Angle in radians

let spinButtonClicked = false;

// Which sector sits at a given screen angle. The spin applies a CSS rotation to
// the canvas, so screen angles and wheel angles differ by exactly that rotation.
// Scaling to sector units before flooring, rather than normalising the angle
// first, is what keeps this exact for an angle landing on a sector border.
function sectorIndexAtAngle(screenAngle) {
  const wheelAngle = screenAngle - (ang - PI / 2);
  const index = Math.floor((wheelAngle / TAU) * sectors.length);
  return ((index % sectors.length) + sectors.length) % sectors.length;
}

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

const labelFont = (size) => `bold ${size}px 'Lato', sans-serif`;

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

  angVel *= friction; // Decrement velocity by friction
  if (angVel < 0.002) angVel = 0; // Bring to stop
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
        if (!angVel) angVel = rand(0.25, 0.45);
        spinButtonClicked = true;
      });
      canvas.addEventListener("click", handleWheelClick);
    })
    .catch(() => {});
}

init();
