import { pickDifferent } from "./pick-photo.mjs";

const page = document.querySelector(".easter_egg");
const photo = document.getElementById("egg_photo");
const heart = document.getElementById("egg_heart");

// The list is written into the page at build time from whatever is sitting in
// src/images/easter_egg, so adding a photo needs no code change.
let photos = [];
try {
  photos = JSON.parse(page.dataset.photos);
} catch {
  photos = [];
}

// What the element is actually showing. Reading photo.src back would give an
// absolute URL, which would never match the site-relative paths in the list.
let showing = null;

function show(next) {
  if (!next) return;
  showing = next;

  // Load it out of sight first. Assigning src directly leaves the frame blank
  // until the file arrives, which on a phone is long enough to look broken.
  const preload = new Image();
  const reveal = () => {
    // An impatient double-click starts two loads; ignore whichever comes back
    // out of turn so the photo matches what we last chose.
    if (showing !== next) return;
    photo.src = next;
    photo.hidden = false;
  };
  preload.addEventListener("load", reveal);
  // Show it anyway on error, so a missing file surfaces as a broken image
  // rather than an empty page that looks like the feature simply failed.
  preload.addEventListener("error", reveal);
  preload.src = next;
}

// Deliberately no history entry per photo — the back button should go straight
// back to the wheel, not walk through every photo dealt along the way.
heart.addEventListener("click", () => show(pickDifferent(photos, showing)));

show(pickDifferent(photos, showing));
