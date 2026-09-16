// Fractions that have a single Unicode character. Anything not in here (3/16,
// or a ratio like 30/40) is left exactly as written.
const VULGAR_FRACTIONS = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
  "1/5": "⅕",
  "2/5": "⅖",
  "3/5": "⅗",
  "4/5": "⅘",
  "1/6": "⅙",
  "5/6": "⅚",
  "1/7": "⅐",
  "1/8": "⅛",
  "3/8": "⅜",
  "5/8": "⅝",
  "7/8": "⅞",
  "1/9": "⅑",
  "1/10": "⅒",
};

// A fraction, optionally preceded by a whole number ("1 1/2"). The guards keep it
// from biting into dates (9/16/2026) or decimals (5.3).
const FRACTION_RE = /(\d+\s+)?(?<![\d/.])(\d+)\/(\d+)(?![\d/.])/g;

function formatFractions(text) {
  return text.replace(FRACTION_RE, (match, whole, numerator, denominator) => {
    const vulgar = VULGAR_FRACTIONS[`${numerator}/${denominator}`];
    if (!vulgar) return match;
    return whole ? `${whole.trim()}${vulgar}` : vulgar;
  });
}

module.exports = function (eleventyConfig) {
  // Static assets used by every page — copied through untouched.
  eleventyConfig.addPassthroughCopy("src/styles.css");
  eleventyConfig.addPassthroughCopy("src/wheel.js");

  // Render "1/2" as ½ and "1 1/2" as 1½. Overriding the text rule means code spans
  // and HTML attributes are left alone.
  eleventyConfig.amendLibrary("md", (md) => {
    md.renderer.rules.text = (tokens, idx) =>
      formatFractions(md.utils.escapeHtml(tokens[idx].content));
  });

  // Single source of truth for "what recipes exist" — every file in
  // src/recipes/ becomes part of this collection automatically. Sorted by
  // title so the wheel's sector order doesn't depend on file dates.
  eleventyConfig.addCollection("recipes", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("src/recipes/*.md")
      .sort((a, b) => a.data.title.localeCompare(b.data.title)),
  );

  return {
    dir: {
      input: "src",
      includes: "_includes",
      output: "dist",
    },
  };
};
