import { matchRecipes } from "./search-match.mjs";

const form = document.querySelector("#recipe_search_box");
const input = document.querySelector("#recipe_search");
const list = document.querySelector("#search_results");

let recipes = [];
// Set by Escape. Without it, Escape's own input.focus() fires the focus handler,
// which re-renders and reopens the list that was just dismissed.
let dismissed = false;

// Relative, like the wheel's own fetch: resolved against the page rather than
// this script, which is what keeps it right under a --pathprefix build.
fetch("recipe-index.json")
  .then((res) => (res.ok ? res.json() : []))
  .then((loaded) => {
    recipes = loaded;
    // Somebody may have typed before this arrived.
    if (document.activeElement === input) render();
  })
  .catch(() => {});

function resultLink(recipe) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  // A real link, so clicking and Enter both navigate on their own -- no
  // JavaScript in the path between choosing a recipe and arriving at it.
  link.href = `recipes/${recipe.slug}/`;
  link.textContent = recipe.label;
  link.className = "search_result";
  item.append(link);
  return item;
}

function render() {
  const query = input.value;
  const matches = matchRecipes(recipes, query);
  list.replaceChildren();

  if (dismissed || !query.trim()) {
    list.hidden = true;
    return;
  }

  if (matches.length === 0) {
    // A box that silently does nothing reads as broken.
    const empty = document.createElement("li");
    empty.className = "search_empty";
    empty.textContent = "no recipes match";
    list.append(empty);
  } else {
    list.append(...matches.map(resultLink));
  }
  list.hidden = false;
}

function close() {
  list.hidden = true;
}

// Typing is what undoes a dismissal; merely refocusing is not, or Escape would
// undo itself.
input.addEventListener("input", () => {
  dismissed = false;
  render();
});
input.addEventListener("focus", render);

form.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    dismissed = true;
    close();
    input.focus();
    return;
  }

  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const options = [...list.querySelectorAll(".search_result")];
  if (!options.length) return;
  event.preventDefault();

  const at = options.indexOf(document.activeElement);
  const step = event.key === "ArrowDown" ? 1 : -1;
  // From the input, ArrowUp wraps to the last result.
  const next = at === -1 ? (step === 1 ? 0 : options.length - 1) : at + step;

  if (next < 0) input.focus();
  else if (next >= options.length) options[options.length - 1].focus();
  else options[next].focus();
});

// Close when focus leaves the box entirely. Checking where focus went matters:
// focusout fires before a result's click, so closing unconditionally would
// remove the link out from under the pointer and nothing would ever open.
form.addEventListener("focusout", (event) => {
  if (form.contains(event.relatedTarget)) return;
  // Leaving the box clears the dismissal, so coming back to it works normally.
  dismissed = false;
  close();
});
