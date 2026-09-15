module.exports = function (eleventyConfig) {
  // Static assets used by every page — copied through untouched.
  eleventyConfig.addPassthroughCopy("src/styles.css");
  eleventyConfig.addPassthroughCopy("src/wheel.js");

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
