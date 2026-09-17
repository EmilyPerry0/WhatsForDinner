const fs = require("node:fs");

const EGG_IMAGE_DIR = "src/images/easter_egg";

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

// Whether the token at idx sits between a link_open and its link_close.
function insideLink(tokens, idx) {
  let depth = 0;
  for (let i = idx - 1; i >= 0; i--) {
    if (tokens[i].type === "link_close") depth--;
    else if (tokens[i].type === "link_open") depth++;
  }
  return depth > 0;
}

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
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/recipe.mjs");
  eleventyConfig.addPassthroughCopy("src/ingredient-key.mjs");
  eleventyConfig.addPassthroughCopy("src/easter-egg.mjs");
  eleventyConfig.addPassthroughCopy("src/pick-photo.mjs");

  // The easter egg page picks from whatever photos are sitting in the folder, so
  // dropping a new one in is all it takes — no list to keep in step by hand.
  eleventyConfig.addGlobalData("eggImages", () =>
    fs
      .readdirSync(EGG_IMAGE_DIR)
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .sort(),
  );

  eleventyConfig.amendLibrary("md", (md) => {
    // Turn a bare URL in a recipe into a link. Markdown only auto-links the
    // <https://...> and [text](...) forms on its own.
    md.set({ linkify: true });

    // Render "1/2" as ½ and "1 1/2" as 1½. Overriding the text rule means code spans
    // and HTML attributes are left alone. Link text is skipped as well: a URL's
    // visible text is a text token too, so a link to "...?serves=1/2" would
    // otherwise read "?serves=½" while pointing at the unconverted address.
    md.renderer.rules.text = (tokens, idx) => {
      const escaped = md.utils.escapeHtml(tokens[idx].content);
      return insideLink(tokens, idx) ? escaped : formatFractions(escaped);
    };

    // Send external links to a new tab, leaving relative ones alone.
    const renderLink =
      md.renderer.rules.link_open ||
      ((tokens, idx, options, env, self) =>
        self.renderToken(tokens, idx, options));

    md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
      const href = tokens[idx].attrGet("href") || "";
      if (/^https?:\/\//.test(href)) {
        tokens[idx].attrSet("target", "_blank");
        tokens[idx].attrSet("rel", "noopener");
      }
      return renderLink(tokens, idx, options, env, self);
    };
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
