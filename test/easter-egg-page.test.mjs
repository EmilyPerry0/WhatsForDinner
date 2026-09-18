import test from "node:test";
import assert from "node:assert/strict";
import { installDom, freshImport } from "./helpers/dom.mjs";

const loadEasterEggScript = () => freshImport("src/assets/js/easter-egg.mjs");

const PHOTOS = ["/p/a.jpg", "/p/b.jpg", "/p/c.jpg", "/p/d.jpg"];

// Mirrors what easter-egg.njk produces, with the photo list rendered into the
// attribute at build time.
function eggPage(photos) {
  const attr =
    photos === null ? "" : JSON.stringify(photos).replace(/"/g, "&quot;");
  return `<!doctype html><html><body>
    <main class="easter_egg" data-photos="${attr}">
      <img class="easter_egg_photo" id="egg_photo" hidden />
      <button type="button" id="egg_heart"><img /></button>
    </main>
  </body></html>`;
}

// The module preloads into a detached Image and only swaps the visible photo
// once that fires. Nothing loads in jsdom, so stand in for the network.
function capturePreloads() {
  const pending = [];
  class RecordingImage {
    constructor() {
      this.listeners = {};
      pending.push(this);
    }
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    }
    set src(value) {
      this._src = value;
    }
    get src() {
      return this._src;
    }
    finish(type = "load") {
      (this.listeners[type] ?? []).forEach((fn) => fn());
    }
  }
  Object.defineProperty(globalThis, "Image", {
    value: RecordingImage,
    configurable: true,
    writable: true,
  });
  return pending;
}

const photo = () => document.querySelector("#egg_photo");
const heart = () => document.querySelector("#egg_heart");

test("shows a photo from the list once it has loaded", async () => {
  installDom(eggPage(PHOTOS));
  const loads = capturePreloads();
  await loadEasterEggScript();

  assert.equal(loads.length, 1, "one photo is preloaded on arrival");
  assert.ok(PHOTOS.includes(loads[0].src), "and it comes from the list");
  assert.equal(photo().hidden, true, "nothing is shown until it has loaded");

  loads[0].finish();
  assert.equal(photo().getAttribute("src"), loads[0].src);
  assert.equal(photo().hidden, false);
});

test("the heart deals a different photo", async () => {
  // A button that sometimes appears to do nothing reads as broken, so the next
  // photo is never the one already showing.
  installDom(eggPage(PHOTOS));
  const loads = capturePreloads();
  await loadEasterEggScript();

  loads[0].finish();

  for (let i = 0; i < 20; i++) {
    const showing = photo().getAttribute("src");
    heart().click();
    const next = loads.at(-1);
    assert.notEqual(next.src, showing, "never re-deals what is on screen");
    next.finish();
  }
  assert.ok(photo().getAttribute("src"));
});

test("a photo that fails to load is still shown rather than left blank", async () => {
  // Better a broken-image icon than an empty page that looks like the feature
  // never worked.
  installDom(eggPage(PHOTOS));
  const loads = capturePreloads();
  await loadEasterEggScript();

  loads[0].finish("error");
  assert.equal(photo().hidden, false);
  assert.equal(photo().getAttribute("src"), loads[0].src);
});

test("an out-of-order load does not overwrite a newer choice", async () => {
  // Two quick clicks start two loads; whichever returns late must not win.
  installDom(eggPage(PHOTOS));
  const loads = capturePreloads();
  await loadEasterEggScript();
  loads[0].finish();

  heart().click();
  heart().click();
  const [, second, third] = loads;

  third.finish();
  assert.equal(photo().getAttribute("src"), third.src);

  second.finish(); // arrives late
  assert.equal(
    photo().getAttribute("src"),
    third.src,
    "the newer choice stays on screen",
  );
});

test("survives a missing or malformed photo list", async () => {
  for (const page of [eggPage([]), eggPage(null), eggPage(["only.jpg"])]) {
    installDom(page);
    const loads = capturePreloads();
    await assert.doesNotReject(loadEasterEggScript);
    // With one photo it shows it; with none it simply shows nothing.
    if (loads.length) loads[0].finish();
  }
});

test("a single photo keeps working when the heart is clicked", async () => {
  // There is no "different" photo to pick, so it must re-show the only one
  // rather than search forever or blank the page.
  installDom(eggPage(["only.jpg"]));
  const loads = capturePreloads();
  await loadEasterEggScript();
  loads[0].finish();

  heart().click();
  loads.at(-1).finish();
  assert.equal(photo().getAttribute("src"), "only.jpg");
  assert.equal(photo().hidden, false);
});
