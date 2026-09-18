import test, { mock } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const eggImages = require("../src/_data/eggImages.js");

const DIR = "src/assets/images/easter-egg";

test("lists the photos actually sitting in the folder", () => {
  const names = eggImages();
  assert.ok(names.length > 0, "the easter egg needs at least one photo");
  // Asserted as a property rather than a count, so dropping a new photo in
  // doesn't fail the test -- which is the whole promise of reading the folder.
  for (const name of names) {
    assert.ok(
      fs.existsSync(`${DIR}/${name}`),
      `${name} is listed but not on disk`,
    );
  }
});

test("sorts and filters whatever the directory hands back", () => {
  // Asserting that the real folder comes back sorted proves nothing: readdir
  // already returns these names in order, so the sort could be deleted and the
  // test would still pass. Feed it a deliberately unsorted, mixed listing.
  mock.method(fs, "readdirSync", () => [
    "egg-3.jpg",
    "notes.txt",
    "egg-1.JPG",
    ".DS_Store",
    "egg-2.png",
    "thumbs.db",
    "egg-10.webp",
  ]);
  try {
    assert.deepEqual(eggImages(), [
      "egg-1.JPG",
      "egg-10.webp",
      "egg-2.png",
      "egg-3.jpg",
    ]);
  } finally {
    mock.restoreAll();
  }
});

test("ignores anything that is not an image", () => {
  // A stray .DS_Store or a README in that folder must not become a photo the
  // page tries to display.
  for (const name of eggImages()) {
    assert.match(name, /\.(jpe?g|png|webp)$/i, `${name} is not an image`);
  }
});

test("every image file in the folder is picked up", () => {
  // The other direction: a photo on disk that the filter drops would silently
  // never appear.
  const onDisk = fs
    .readdirSync(DIR)
    .filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
    .sort();
  assert.deepEqual(eggImages(), onDisk);
});
