const textColor = "#3D3750";
const wheelBackgroundColor_1 = "#5DC0EC";
const wheelBackgroundColor_2 = "#F57AC5";

const SPIN_AGAIN_LABEL = "Spin Again!";

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
const PI = Math.PI;
const TAU = 2 * PI;
let arc = 0;

const friction = 0.991; // 0.995=soft, 0.99=mid, 0.98=hard
let angVel = 0; // Angular velocity
let ang = 0; // Angle in radians

let spinButtonClicked = false;

const getIndex = () =>
  Math.floor(sectors.length - (ang / TAU) * sectors.length) % sectors.length;

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
  ctx.fillStyle = sector.text;
  const fontSize = Math.max(12, rad * 0.075);
  ctx.font = `bold ${fontSize}px 'Lato', sans-serif`;
  ctx.fillText(sector.label, rad - 10, 10);
  //

  ctx.restore();
}

function drawWheel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  sectors.forEach(drawSector);
}

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scaling before reapplying
  ctx.scale(dpr, dpr);

  // Recalculate dia/rad based on CSS size, not the scaled buffer size
  dia = rect.width;
  rad = dia / 2;

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
    // The "Spin Again" sector has no slug, so landing on it goes nowhere.
    if (sector.slug) {
      setTimeout(function () {
        window.location.href = `recipes/${sector.slug}/`;
      }, 1000);
    }
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
    })
    .catch(() => {});
}

init();
