import { ingredientKey } from "./ingredient-key.mjs";

// Checked ingredients are stored per recipe, keyed by the page's own path, and
// held as ingredient *names* rather than positions — that's what makes the same
// ingredient tick off everywhere it appears, whatever the amount beside it.
const STORAGE_KEY = `ingredients:${location.pathname}`;

// localStorage throws in private mode. Persistence is a nicety here, so lose it
// quietly rather than taking the page down with it.
function loadChecked() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveChecked(checked) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]));
  } catch {
    // no persistence available; the checkboxes still work for this visit
  }
}

// Every <ul> that follows a heading naming ingredients. Walking forward rather
// than assuming the list is the very next node lets a section carry a note first,
// and stopping at the next heading keeps one section from swallowing another.
function ingredientLists() {
  const lists = [];
  const headings = document.querySelectorAll(
    ".recipe h2, .recipe h3, .recipe h4, .recipe h5, .recipe h6",
  );

  for (const heading of headings) {
    if (!/ingredient/i.test(heading.textContent)) continue;

    for (let el = heading.nextElementSibling; el; el = el.nextElementSibling) {
      if (/^H[1-6]$/.test(el.tagName)) break;
      if (el.tagName === "UL") {
        lists.push(el);
        break;
      }
    }
  }
  return lists;
}

function makeCheckboxes() {
  const items = [];

  for (const list of ingredientLists()) {
    list.classList.add("ingredient_list");

    for (const li of list.querySelectorAll(":scope > li")) {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";

      const text = document.createElement("span");
      // Move the rendered markup across rather than reading textContent, so the
      // fractions and any inline formatting the build produced survive.
      while (li.firstChild) text.append(li.firstChild);

      label.append(box, text);
      li.append(label);
      items.push({ li, box, key: ingredientKey(text.textContent) });
    }
  }
  return items;
}

function init() {
  const items = makeCheckboxes();
  if (!items.length) return;

  const checked = loadChecked();

  // One ingredient can appear several times in a recipe, so state lives on the
  // name and every box sharing it is redrawn together.
  const render = () => {
    for (const item of items) {
      item.box.checked = checked.has(item.key);
      item.li.classList.toggle("is_checked", item.box.checked);
    }
  };

  for (const item of items) {
    item.box.addEventListener("change", () => {
      if (item.box.checked) checked.add(item.key);
      else checked.delete(item.key);
      saveChecked(checked);
      render();
    });
  }

  const reset = document.querySelector("#reset_ingredients");
  if (reset) {
    reset.hidden = false;
    reset.addEventListener("click", () => {
      checked.clear();
      saveChecked(checked);
      render();
    });
  }

  render();
}

init();
