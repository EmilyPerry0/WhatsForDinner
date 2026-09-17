// Reduces an ingredient line to just the ingredient's name, so the same thing
// checks off together wherever it appears in a recipe and whatever the amount:
// "2 Tbsp soy sauce" and "½ Tbsp soy sauce" both come back as "soy sauce".
//
// This is a heuristic. It deliberately leaves differently-specified things apart
// ("400g firm tofu" stays distinct from "1 Block Tofu"), on the grounds that
// wrongly linking two ingredients is worse than wrongly separating them.

// Words that measure an ingredient rather than name it.
const UNITS = new Set([
  "g",
  "kg",
  "mg",
  "ml",
  "l",
  "oz",
  "lb",
  "lbs",
  "tsp",
  "tsps",
  "teaspoon",
  "teaspoons",
  "tbsp",
  "tbsps",
  "tablespoon",
  "tablespoons",
  "cup",
  "cups",
  "clove",
  "cloves",
  "sprig",
  "sprigs",
  "can",
  "cans",
  "block",
  "blocks",
  "bunch",
  "bunches",
  "pinch",
  "pinches",
  "slice",
  "slices",
  "piece",
  "pieces",
  "small",
  "large",
  "medium",
]);

// Words that introduce a quantity without being one.
const LEADING_FILLER = new Set(["a", "an", "of"]);

// Digits, decimals, ranges, and the vulgar fractions the build renders — by the
// time this runs "1/2" is already "½", so matching ASCII slashes isn't enough.
const QUANTITY = /^[\d.,\-–—/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞]+$/u;

// A quantity with the unit stuck to it: "400g", "15oz".
const QUANTITY_WITH_UNIT = /^([\d.,\-–—/½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞]+)([a-z]+)$/u;

function isQuantityOrUnit(token) {
  if (QUANTITY.test(token)) return true;
  if (UNITS.has(token)) return true;
  if (LEADING_FILLER.has(token)) return true;

  const withUnit = QUANTITY_WITH_UNIT.exec(token);
  return withUnit !== null && UNITS.has(withUnit[2]);
}

export function ingredientKey(text) {
  let s = String(text).toLowerCase();

  s = s.split(",")[0]; // "garlic, pressed" -> "garlic"
  s = s.replace(/\([^)]*\)/gu, " "); // "cup (80ml) juice" -> "cup   juice"
  s = s.replace(/\bto taste\b/gu, " "); // "salt to taste" -> "salt"

  const tokens = s.split(/\s+/u).filter(Boolean);

  let i = 0;
  while (i < tokens.length && isQuantityOrUnit(tokens[i])) i++;

  // If the line is nothing but quantities, it has no name to key on; fall back to
  // the whole line so such an item at least stays distinct from everything else.
  const name = tokens.slice(i).join(" ").trim();
  return name || tokens.join(" ").trim();
}
