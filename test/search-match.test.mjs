import test from "node:test";
import assert from "node:assert/strict";
import { matchRecipes } from "../src/assets/js/search-match.mjs";

// The labels the build really puts in recipe-index.json, in the order it sorts
// them, so these cases stay honest about what someone would actually see.
const RECIPES = [
  ["arayes", "Arayes"],
  ["bean-slop-stew", "Bean Slop Stew"],
  ["buffalo-bean-dip", "Buffalo Bean Dip"],
  ["creamy-crispy-chili-tofu", "Creamy Crispy Chili Tofu"],
  ["hot-honey-tofu-sliders", "Hot Honey Tofu Sliders"],
  ["orange-tofu", "Orange Tofu"],
  ["tofu-tacos", "Shredded Tofu Tacos"],
  ["tofu-lime-curry", "Tofu Lime Curry"],
].map(([slug, label]) => ({ slug, label }));

const labels = (query) => matchRecipes(RECIPES, query).map((r) => r.label);

test("finds every recipe containing the text, not just ones starting with it", () => {
  // "Orange Tofu" and "Shredded Tofu Tacos" only match in the middle.
  assert.deepEqual(labels("tofu"), [
    "Creamy Crispy Chili Tofu",
    "Hot Honey Tofu Sliders",
    "Orange Tofu",
    "Shredded Tofu Tacos",
    "Tofu Lime Curry",
  ]);
});

test("ignores case in both the query and the recipe name", () => {
  assert.deepEqual(labels("TOFU"), labels("tofu"));
  assert.deepEqual(labels("ToFu"), labels("tofu"));
  assert.deepEqual(labels("bean"), ["Bean Slop Stew", "Buffalo Bean Dip"]);
});

test("keeps the order it was given, which is alphabetical", () => {
  // The build sorts recipe-index.json by title; the results must not reshuffle.
  const all = matchRecipes(RECIPES, "e").map((r) => r.label);
  assert.deepEqual(
    all,
    [...all].sort((a, b) => a.localeCompare(b)),
  );
});

test("matches across whole words and punctuation", () => {
  assert.deepEqual(labels("lime curry"), ["Tofu Lime Curry"]);
  assert.deepEqual(labels("slop"), ["Bean Slop Stew"]);
});

test("an empty box offers nothing", () => {
  // This is what keeps the dropdown closed until somebody types.
  assert.deepEqual(matchRecipes(RECIPES, ""), []);
  assert.deepEqual(matchRecipes(RECIPES, "   "), []);
  assert.deepEqual(matchRecipes(RECIPES, null), []);
  assert.deepEqual(matchRecipes(RECIPES, undefined), []);
});

test("surrounding whitespace does not change the result", () => {
  assert.deepEqual(labels("  tofu  "), labels("tofu"));
});

test("text matching nothing returns nothing", () => {
  assert.deepEqual(labels("pizza"), []);
  assert.deepEqual(labels("zzzz"), []);
});

test("returns whole recipe entries, so the link has a slug to use", () => {
  const [first] = matchRecipes(RECIPES, "orange");
  assert.equal(first.slug, "orange-tofu");
  assert.equal(first.label, "Orange Tofu");
});

test("copes with a missing or malformed recipe list", () => {
  // The list arrives over the network and the box is usable before it lands.
  assert.deepEqual(matchRecipes([], "tofu"), []);
  assert.deepEqual(matchRecipes(undefined, "tofu"), []);
  assert.deepEqual(matchRecipes(null, "tofu"), []);
  // An entry with no label must not throw.
  assert.deepEqual(matchRecipes([{ slug: "x" }], "tofu"), []);
});
