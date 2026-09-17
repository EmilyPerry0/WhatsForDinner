import test from "node:test";
import assert from "node:assert/strict";
import { pickDifferent } from "../src/pick-photo.mjs";

const PHOTOS = ["a.jpg", "b.jpg", "c.jpg", "d.jpg"];

test("never hands back the photo already showing", () => {
  // The whole point of the heart button is that it visibly changes something.
  for (const current of PHOTOS) {
    for (let i = 0; i < 100; i++) {
      assert.notEqual(pickDifferent(PHOTOS, current), current);
    }
  }
});

test("can reach every photo", () => {
  // A subtle off-by-one in the index would quietly make one photo unreachable.
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    seen.add(pickDifferent(PHOTOS, "a.jpg"));
  }
  assert.deepEqual([...seen].sort(), ["b.jpg", "c.jpg", "d.jpg"]);

  // Including the one excluded above, once something else is showing.
  assert.ok(
    Array.from({ length: 500 }, () => pickDifferent(PHOTOS, "b.jpg")).includes(
      "a.jpg",
    ),
  );
});

test("picks deterministically from the injected random", () => {
  // Ordering matters: the pool has `current` removed, so the indexes shift.
  assert.equal(
    pickDifferent(PHOTOS, "a.jpg", () => 0),
    "b.jpg",
  );
  assert.equal(
    pickDifferent(PHOTOS, "a.jpg", () => 0.99),
    "d.jpg",
  );
  assert.equal(
    pickDifferent(PHOTOS, "c.jpg", () => 0),
    "a.jpg",
  );
  // A random that returns exactly 1 must not index off the end.
  assert.equal(
    pickDifferent(PHOTOS, "a.jpg", () => 1),
    "d.jpg",
  );
});

test("copes with nothing showing and with degenerate lists", () => {
  // First load: no photo is showing, so any of them will do.
  assert.ok(PHOTOS.includes(pickDifferent(PHOTOS, null)));
  assert.ok(PHOTOS.includes(pickDifferent(PHOTOS, undefined)));
  // One photo: return it rather than searching forever for a different one.
  assert.equal(pickDifferent(["only.jpg"], "only.jpg"), "only.jpg");
  // No photos at all shouldn't throw — the page just shows nothing.
  assert.equal(pickDifferent([], null), undefined);
  assert.equal(pickDifferent(undefined, null), undefined);
});
