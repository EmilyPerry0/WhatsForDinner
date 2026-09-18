import test from "node:test";
import assert from "node:assert/strict";
import { installDom, freshImport } from "./helpers/dom.mjs";

const RECIPES = [
  { slug: "arayes", label: "Arayes" },
  { slug: "bean-slop-stew", label: "Bean Slop Stew" },
  { slug: "orange-tofu", label: "Orange Tofu" },
  { slug: "tofu-tacos", label: "Shredded Tofu Tacos" },
];

// Mirrors the search markup in index.html.
const PAGE = `<!doctype html><html><body>
  <div class="center">
    <div class="search" id="recipe_search_box">
      <input type="text" id="recipe_search" class="search_input" placeholder=" " />
      <ul class="search_results" id="search_results" hidden></ul>
    </div>
    <div id="spinner_wheel"></div>
  </div>
</body></html>`;

// search.mjs fetches recipe-index.json as it loads; stand in for the network.
function stubFetch(recipes = RECIPES, { ok = true } = {}) {
  Object.defineProperty(globalThis, "fetch", {
    value: async () => ({ ok, json: async () => recipes }),
    configurable: true,
    writable: true,
  });
}

// Load the module and let its fetch resolve.
async function loadSearch() {
  const module = await freshImport("src/assets/js/search.mjs");
  await new Promise((resolve) => setTimeout(resolve, 0));
  return module;
}

const input = () => document.querySelector("#recipe_search");
const list = () => document.querySelector("#search_results");
const results = () => [...list().querySelectorAll(".search_result")];

function type(text) {
  input().value = text;
  input().dispatchEvent(new Event("input", { bubbles: true }));
}

test("typing lists the matching recipes as links", async () => {
  installDom(PAGE);
  stubFetch();
  await loadSearch();

  assert.equal(list().hidden, true, "closed until somebody types");

  type("tofu");

  assert.equal(list().hidden, false);
  assert.deepEqual(
    results().map((a) => a.textContent),
    ["Orange Tofu", "Shredded Tofu Tacos"],
  );
});

test("each result links to that recipe's page", async () => {
  // The links are what actually navigate, so the href is the whole feature.
  installDom(PAGE);
  stubFetch();
  await loadSearch();

  type("orange");
  assert.deepEqual(
    results().map((a) => a.getAttribute("href")),
    ["recipes/orange-tofu/"],
  );
});

test("clearing the box closes the list again", async () => {
  installDom(PAGE);
  stubFetch();
  await loadSearch();

  type("tofu");
  assert.equal(list().hidden, false);

  type("");
  assert.equal(list().hidden, true);
  assert.equal(results().length, 0);

  // Whitespace alone counts as empty.
  type("   ");
  assert.equal(list().hidden, true);
});

test("says so when nothing matches", async () => {
  // Showing nothing at all would look like the search was broken.
  installDom(PAGE);
  stubFetch();
  await loadSearch();

  type("pizza");
  assert.equal(list().hidden, false);
  assert.equal(results().length, 0);
  assert.match(list().textContent, /no recipes match/i);
});

test("Escape dismisses the list", async () => {
  const dom = installDom(PAGE);
  stubFetch();
  await loadSearch();

  type("tofu");
  assert.equal(list().hidden, false);

  input().dispatchEvent(
    new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
  );
  assert.equal(list().hidden, true);
});

test("moving focus onto a result does not close the list", async () => {
  // The trap: focusout fires before the link's click, so closing on any blur
  // would pull the result out from under the pointer and nothing could open.
  const dom = installDom(PAGE);
  stubFetch();
  await loadSearch();

  type("tofu");
  const first = results()[0];

  document.querySelector("#recipe_search_box").dispatchEvent(
    new dom.window.FocusEvent("focusout", {
      bubbles: true,
      relatedTarget: first,
    }),
  );

  assert.equal(list().hidden, false, "the result must still be there to click");
});

test("focus leaving the box entirely does close it", async () => {
  const dom = installDom(PAGE);
  stubFetch();
  await loadSearch();

  type("tofu");
  document.querySelector("#recipe_search_box").dispatchEvent(
    new dom.window.FocusEvent("focusout", {
      bubbles: true,
      relatedTarget: document.querySelector("#spinner_wheel"),
    }),
  );

  assert.equal(list().hidden, true);
});

test("arrow keys step from the box into the results", async () => {
  const dom = installDom(PAGE);
  stubFetch();
  await loadSearch();

  type("tofu");
  const press = (key) =>
    input().dispatchEvent(
      new dom.window.KeyboardEvent("keydown", { key, bubbles: true }),
    );

  press("ArrowDown");
  assert.equal(document.activeElement, results()[0]);
});

test("works even if the recipe list never loads", async () => {
  // The box is on screen before the fetch resolves, and the fetch can fail.
  installDom(PAGE);
  Object.defineProperty(globalThis, "fetch", {
    value: async () => {
      throw new Error("offline");
    },
    configurable: true,
    writable: true,
  });

  await assert.doesNotReject(loadSearch);
  type("tofu");
  assert.match(list().textContent, /no recipes match/i);
});
