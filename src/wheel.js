const textColor = "#FFFFFF"
const wheelBackgroundColor_1 = "#4203ff"
const wheelBackgroundColor_2 = "#ff10ab"

const sectors = [
  { color: wheelBackgroundColor_1, text: textColor, label: "Tofu Tacos" },
  { color: wheelBackgroundColor_2, text: textColor, label: "Orange Tofu" },
  { color: wheelBackgroundColor_1, text: textColor, label: "Curry" },
  { color: wheelBackgroundColor_2, text: textColor, label: "Wraps" },
  { color: wheelBackgroundColor_1, text: textColor, label: "Takeout" },
  { color: wheelBackgroundColor_2, text: textColor, label: "Pasta" },
  { color: wheelBackgroundColor_1, text: textColor, label: "Smash \"Burgers\"" },
  { color: wheelBackgroundColor_2, text: textColor, label: "Dal" },
];

const events = {
  listeners: {},
  addListener: function (eventName, fn) {
    this.listeners[eventName] = this.listeners[eventName] || [];
    this.listeners[eventName].push(fn);
  },
  fire: function (eventName, ...args) {
    if (this.listeners[eventName]) {
      for (let fn of this.listeners[eventName]) {
        fn(...args);
      }
    }
  },
};

const rand = (m, M) => Math.random() * (M - m) + m;
const tot = sectors.length;
const spinEl = document.querySelector("#spin_button");
const ctx = document.querySelector("#wheel").getContext("2d");
const dia = ctx.canvas.width;
const rad = dia / 2;
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
  ctx.font = "bold 30px 'Lato', sans-serif";
  ctx.fillText(sector.label, rad - 10, 10);
  //

  ctx.restore();
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
    const sector = sectors[getIndex()]; // maybe use this to figure out which page to go to.
    setTimeout(function() {
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
  sectors.forEach(drawSector);
  engine(); // Start engine
  spinEl.addEventListener("click", () => {
    if (!angVel) angVel = rand(0.25, 0.45);
    spinButtonClicked = true;
  });
}

init();