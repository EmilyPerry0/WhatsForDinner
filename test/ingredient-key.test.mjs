import test from "node:test";
import assert from "node:assert/strict";
import { ingredientKey } from "../src/ingredient-key.mjs";

// The groupings below are taken from the real recipe files. Fractions appear as
// the rendered characters (½, ⅓) because the build converts them before any of
// this runs.

test("strips the amount so the same ingredient matches", () => {
  const cases = [
    // [lines that must share a key, the key they should share]
    [["2 Tbsp soy sauce", "½ Tbsp soy sauce", "1 Tbsp Soy Sauce"], "soy sauce"],
    [["2 Tsp cumin", "1 Tsp cumin"], "cumin"],
    [["3 cloves garlic", "2 cloves garlic"], "garlic"],
    [["1 Tsp Paprika", "2 Tsp paprika"], "paprika"],
    [["1 Cup Cream Cheese", "1⅓ Cup cream cheese"], "cream cheese"],
    [["50 ml Soy Milk", "1 cup soy milk"], "soy milk"],
    [["16 oz Penne", "400g penne"], "penne"],
  ];

  for (const [lines, expected] of cases) {
    for (const line of lines) {
      assert.equal(ingredientKey(line), expected, `${line} -> ${expected}`);
    }
  }
});

test("handles the awkward lines the recipes actually contain", () => {
  // tofu-tacos has a line with the quantity missing entirely: "-  Tbsp oil"
  assert.equal(ingredientKey(" Tbsp oil"), "oil");
  // buffalo-bean-dip: a count, then a sized can, then the unit, then "of"
  assert.equal(ingredientKey("4 15oz Cans of White Beans"), "white beans");
  // "salt" and "salt to taste" are the same thing
  assert.equal(ingredientKey("salt"), "salt");
  assert.equal(ingredientKey("salt to taste"), "salt");
  // a parenthetical conversion shouldn't leak into the name
  assert.equal(
    ingredientKey("1/3 cup (80ml) pineapple juice"),
    "pineapple juice",
  );
  assert.equal(
    ingredientKey("⅓ cup (80ml) pineapple juice"),
    "pineapple juice",
  );
  // a trailing preparation note shouldn't either
  assert.equal(ingredientKey("8 Cloves Garlic, pressed"), "garlic");
  // no amount at all
  assert.equal(ingredientKey("Nooch"), "nooch");
  assert.equal(ingredientKey("Tortillas (medium)"), "tortillas");
  // word quantities
  assert.equal(
    ingredientKey("a bunch cilantro or parsley"),
    "cilantro or parsley",
  );
});

test("keeps differently-specified ingredients apart", () => {
  // Wrongly linking two ingredients is worse than wrongly separating them, so
  // these must NOT collapse together if the rules are ever loosened.
  const mustDiffer = [
    ["400g firm tofu", "1 Block Tofu"],
    ["2 Small Yellow Onions", "1 onion"],
    ["4 Tbsp vegan yogurt", "4 Tbsp vegan mayo"],
    ["2 Tsp Salt", "2 Tsp Pepper"],
    ["1 Cup Cream Cheese", "2 Cups Shredded Cheddar"],
    ["soy sauce", "soy milk"],
  ];

  for (const [a, b] of mustDiffer) {
    assert.notEqual(
      ingredientKey(a),
      ingredientKey(b),
      `${a} and ${b} should not share a key`,
    );
  }
});

test("is stable and total", () => {
  // Same input, same key — the whole scheme depends on it.
  assert.equal(
    ingredientKey("2 Tbsp soy sauce"),
    ingredientKey("2 TBSP Soy Sauce"),
  );
  // Degenerate input shouldn't throw or produce an empty key that would collide
  // with every other empty one.
  assert.equal(ingredientKey("2 Tbsp"), "2 tbsp");
  assert.equal(ingredientKey(""), "");
});
