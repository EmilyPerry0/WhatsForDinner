import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const MarkdownIt = require("markdown-it");
const amendMarkdown = require("../config/markdown.js");

// Eleventy hands amendMarkdown its own markdown-it instance; this stands in for
// it. Every assertion below is on what a recipe page actually ends up rendering.
function render(markdown) {
  const md = new MarkdownIt({ html: true });
  amendMarkdown(md);
  return md.render(markdown);
}

test("renders fractions as single characters", () => {
  assert.match(render("- 1/2 cup sugar"), /½ cup sugar/);
  assert.match(render("- 3/4 tsp salt"), /¾ tsp salt/);
  assert.match(render("- 2/3 cup rice"), /⅔ cup rice/);
  // A whole number in front is joined to the fraction: "1 1/2" -> "1½".
  assert.match(render("- 1 1/2 cups flour"), /1½ cups flour/);
});

test("leaves alone anything that is not a fraction it knows", () => {
  // No single character exists for these, so they must survive as typed.
  assert.match(render("- 3/16 inch"), /3\/16 inch/);
  assert.match(render("- a 30/40 ratio"), /30\/40 ratio/);
});

test("does not bite into dates or decimals", () => {
  // The guards around the pattern exist for exactly these.
  assert.match(render("Updated 9/16/2026 by hand"), /9\/16\/2026/);
  assert.match(render("Heat to 5.3 degrees"), /5\.3 degrees/);
  assert.match(render("Serves 1/2/3 people"), /1\/2\/3/);
});

test("leaves code spans untouched", () => {
  // Overriding the text rule rather than the whole render is what buys this.
  const html = render("Run `curl a/b?x=1/2` first");
  assert.match(html, /<code>curl a\/b\?x=1\/2<\/code>/);
  assert.doesNotMatch(html, /½/);
});

test("turns a bare URL into a link", () => {
  // Markdown only auto-links <...> and [text](...) on its own; recipes paste
  // bare URLs.
  const html = render("Adapted from https://example.com/recipe");
  assert.match(html, /<a[^>]+href="https:\/\/example\.com\/recipe"/);
});

test("sends external links to a new tab but not relative ones", () => {
  const external = render("[source](https://example.com)");
  assert.match(external, /target="_blank"/);
  assert.match(external, /rel="noopener"/);

  const internal = render("[the wheel](/)");
  assert.doesNotMatch(internal, /target="_blank"/);
});

test("a fraction inside link text does not corrupt the link", () => {
  // This collision actually shipped once: a URL's visible text is a text token
  // too, so the fraction rule rewrote the displayed address while the href kept
  // the original -- a link that read one way and went another.
  const html = render("See https://example.com/r?serves=1/2 for more");
  assert.match(
    html,
    /href="https:\/\/example\.com\/r\?serves=1\/2"/,
    "href must keep the literal fraction",
  );
  assert.doesNotMatch(html, /½/, "link text must not be rewritten either");
});

test("still converts fractions elsewhere on a line that has a link", () => {
  // The guard skips link text specifically, not the whole paragraph.
  const html = render("Use 1/2 cup, see [here](https://example.com)");
  assert.match(html, /½ cup/);
  assert.match(html, /href="https:\/\/example\.com"/);
});

test("escapes HTML in recipe text rather than rendering it", () => {
  // The text rule does its own escaping, so it has to keep doing it.
  assert.match(render("5 < 6 & 7 > 2"), /5 &lt; 6 &amp; 7 &gt; 2/);
});
