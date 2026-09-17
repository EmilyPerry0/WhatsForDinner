// Markdown rendering tweaks for the recipe pages. Lives outside src/ because
// Eleventy would otherwise treat a .js file in its input directory as a template.

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

// Passed to eleventyConfig.amendLibrary("md", ...).
module.exports = function amendMarkdown(md) {
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
};
