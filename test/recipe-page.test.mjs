import test from "node:test";
import assert from "node:assert/strict";
import { installDom, breakLocalStorage, freshImport } from "./helpers/dom.mjs";

const loadRecipeScript = () => freshImport("src/assets/js/recipe.mjs");

// Mirrors what recipe-layout.njk produces. Kept as a fixture rather than a real
// built page so editing a recipe can't break these; test/build.test.mjs checks
// separately that the real layout still carries the hooks this relies on.
function recipePage(body) {
  return `<!doctype html><html><body>
    <main class="recipe">
      <p class="recipe_top">
        <button type="button" id="reset_ingredients" hidden>reset</button>
      </p>
      <h1>A Recipe</h1>
      ${body}
    </main>
  </body></html>`;
}

const TACOS = `
  <h2>Ingredients (Tofu)</h2>
  <ul><li>400g firm tofu</li><li>2 Tbsp soy sauce</li><li>2 Tsp cumin</li></ul>
  <h2>Ingredients (Sauce)</h2>
  <ul><li>½ Tbsp soy sauce</li><li>1 Tsp cumin</li></ul>
  <h2>Steps</h2>
  <ul><li>Press the tofu</li><li>Fry it</li></ul>
`;

const at = (url) => ({ url: `https://example.com${url}` });
const boxes = () => [
  ...document.querySelectorAll(".recipe input[type=checkbox]"),
];
const labelled = (text) =>
  boxes().find((b) => b.closest("li").textContent.includes(text));
const stored = (path) =>
  JSON.parse(localStorage.getItem(`ingredients:${path}`) ?? "[]");

test("puts a checkbox on every ingredient and none on the steps", async () => {
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  await loadRecipeScript();

  assert.equal(boxes().length, 5, "three tofu ingredients plus two sauce");

  const lists = [...document.querySelectorAll(".recipe ul")];
  assert.ok(lists[0].classList.contains("ingredient_list"));
  assert.ok(lists[1].classList.contains("ingredient_list"));
  assert.ok(
    !lists[2].classList.contains("ingredient_list"),
    "the steps list must be left alone",
  );
});

test("matches any heading with the word ingredient in it", async () => {
  installDom(
    recipePage(`
      <h2>INGREDIENTS</h2><ul><li>salt</li></ul>
      <h3>Ingredient list</h3><ul><li>pepper</li></ul>
      <h4>For the dressing (ingredients)</h4><ul><li>oil</li></ul>
      <h2>Method</h2><ul><li>mix</li></ul>`),
    at("/recipes/x/"),
  );
  await loadRecipeScript();

  assert.equal(boxes().length, 3);
  assert.ok(!labelled("mix"), "Method is not an ingredients heading");
});

test("ticks the same ingredient everywhere, whatever the amount", async () => {
  // The recipes really do this: tofu-tacos lists soy sauce at 2 Tbsp and ½ Tbsp,
  // and cumin at two different amounts in two different sections.
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  await loadRecipeScript();

  labelled("2 Tbsp soy sauce").click();

  assert.equal(labelled("2 Tbsp soy sauce").checked, true);
  assert.equal(
    labelled("½ Tbsp soy sauce").checked,
    true,
    "the other soy sauce, in another section, must tick too",
  );
  assert.equal(labelled("400g firm tofu").checked, false, "and nothing else");

  // Both list items get struck through, not just the one clicked.
  assert.ok(
    labelled("½ Tbsp soy sauce").closest("li").classList.contains("is_checked"),
  );
});

test("keeps different ingredients apart", async () => {
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  await loadRecipeScript();

  labelled("2 Tsp cumin").click();
  assert.equal(labelled("1 Tsp cumin").checked, true, "both cumins");
  assert.equal(labelled("2 Tbsp soy sauce").checked, false);
});

test("saves by ingredient name under a key of its own page", async () => {
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  await loadRecipeScript();

  labelled("2 Tbsp soy sauce").click();
  labelled("2 Tsp cumin").click();

  assert.deepEqual(stored("/recipes/tacos/").sort(), ["cumin", "soy sauce"]);
});

test("restores what was ticked when the page is opened again", async () => {
  // The point of the whole feature: walk to the wheel and back, or close the
  // tab, and the checklist is still where you left it.
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  localStorage.setItem(
    "ingredients:/recipes/tacos/",
    JSON.stringify(["soy sauce"]),
  );
  await loadRecipeScript();

  assert.equal(labelled("2 Tbsp soy sauce").checked, true);
  assert.equal(labelled("½ Tbsp soy sauce").checked, true);
  assert.equal(labelled("2 Tsp cumin").checked, false);
});

test("reset clears this recipe and leaves other recipes alone", async () => {
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  localStorage.setItem(
    "ingredients:/recipes/other/",
    JSON.stringify(["butter"]),
  );
  await loadRecipeScript();

  labelled("2 Tbsp soy sauce").click();
  document.querySelector("#reset_ingredients").click();

  assert.ok(
    boxes().every((b) => !b.checked),
    "every box clears",
  );
  assert.deepEqual(stored("/recipes/tacos/"), []);
  assert.deepEqual(
    stored("/recipes/other/"),
    ["butter"],
    "another recipe's list is untouched",
  );
});

test("shows the reset button only when there is something to reset", async () => {
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  await loadRecipeScript();
  assert.equal(document.querySelector("#reset_ingredients").hidden, false);

  // A recipe with no ingredients section must not offer a dead control.
  installDom(
    recipePage("<h2>Steps</h2><ul><li>Order takeout</li></ul>"),
    at("/recipes/takeout/"),
  );
  await loadRecipeScript();
  assert.equal(document.querySelector("#reset_ingredients").hidden, true);
  assert.equal(boxes().length, 0);
});

test("keeps the rendered markup inside each ingredient", async () => {
  // The build turns 1/2 into ½ and can emit links; moving the nodes rather than
  // re-writing text is what preserves that.
  installDom(
    recipePage(
      `<h2>Ingredients</h2><ul><li>½ cup <em>good</em> olive oil</li></ul>`,
    ),
    at("/recipes/x/"),
  );
  await loadRecipeScript();

  const li = document.querySelector(".ingredient_list li");
  assert.ok(li.querySelector("em"), "inline markup survives");
  assert.match(li.textContent, /½ cup/);
});

test("still works when localStorage is unavailable", async () => {
  // Private mode throws on every access. The checklist should stop persisting,
  // not take the page down.
  installDom(recipePage(TACOS), at("/recipes/tacos/"));
  breakLocalStorage();

  await assert.doesNotReject(loadRecipeScript);
  assert.equal(boxes().length, 5, "checkboxes are still built");

  labelled("2 Tbsp soy sauce").click();
  assert.equal(
    labelled("½ Tbsp soy sauce").checked,
    true,
    "ticking still works",
  );
});
