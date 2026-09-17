const amendMarkdown = require("./config/markdown");

module.exports = function (eleventyConfig) {
  // Everything under src/assets is copied through untouched. One rule rather than
  // one per file: a script that is never passed through 404s at runtime with no
  // build error, so a new stylesheet or module should need no config at all.
  eleventyConfig.addPassthroughCopy("src/assets");

  // Fractions as ½, bare URLs as links, external links to a new tab.
  eleventyConfig.amendLibrary("md", amendMarkdown);

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
