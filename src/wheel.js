const textColor = "#FFFFFF";
const wheelBackgroundColor_1 = "#4203ff";
const wheelBackgroundColor_2 = "#ff10ab";

const sectors = [
  { color: wheelBackgroundColor_1, text: textColor, label: "Tofu Tacos" },
  { color: wheelBackgroundColor_2, text: textColor, label: "Orange Tofu" },
  { color: wheelBackgroundColor_1, text: textColor, label: "Curry" },
  { color: wheelBackgroundColor_2, text: textColor, label: "Wraps" },
  { color: wheelBackgroundColor_1, text: textColor, label: "Takeout" },
  { color: wheelBackgroundColor_2, text: textColor, label: "Pasta" },
  { color: wheelBackgroundColor_1, text: textColor, label: 'Smash "Burgers"' },
  { color: wheelBackgroundColor_2, text: textColor, label: "Dal" },
];

const rand = (m, M) => Math.random() * (M - m) + m;
const tot = sectors.length;
const spinEl = document.querySelector("#spin_button");
const canvas = document.querySelector("#wheel");
const ctx = document.querySelector("#wheel").getContext("2d");
let dia = ctx.canvas.width;
let rad = dia / 2;
const PI = Math.PI;
const TAU = 2 * PI;
const arc = TAU / sectors.length;

const friction = 0.991; // 0.995=soft, 0.99=mid, 0.98=hard
let angVel = 0; // Angular velocity
let ang = 0; // Angle in radians

let spinButtonClicked = false;

const getIndex = () => Math.floor(tot - (ang / TAU) * tot) % tot;

// update this to use simply a list of names and automatically alternate colors
// if number of names is uneven, add a spin again section or a takeout section or something
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
    // const sector = sectors[getIndex()]; // maybe use this to figure out which page to go to.
    setTimeout(function () {
      window.location.href = "orange_tofu_recipe.html";
    }, 1000);
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
  resizeCanvas(); // set initial size + draw
  window.addEventListener("resize", resizeCanvas);
  engine(); // Start engine
  spinEl.addEventListener("click", () => {
    if (!angVel) angVel = rand(0.25, 0.45);
    spinButtonClicked = true;
  });
}

init();
