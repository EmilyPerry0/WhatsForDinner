import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

// A real Eleventy build into a temp directory. Building for ourselves rather than
// reading dist/ means the suite never depends on whether a build ran first, and
// never disturbs the working dist/.
let out;
const pages = [];

function read(file) {
  return fs.readFileSync(path.join(out, file), "utf8");
}

function exists(urlPath) {
  return fs.existsSync(path.join(out, decodeURIComponent(urlPath)));
}

function walk(dir, hit) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, hit);
    else hit(full);
  }
}

// Front matter is simple key: value here, so a full YAML parser isn't needed.
function frontMatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const data = {};
  for (const line of block[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_]+):\s*(.*)$/);
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return data;
}

const recipeFiles = () =>
  fs
    .readdirSync("src/recipes")
    .filter((f) => f.endsWith(".md"))
    .map((f) => ({ file: path.join("src/recipes", f), slug: f.slice(0, -3) }));

before(() => {
  out = fs.mkdtempSync(path.join(os.tmpdir(), "wfd-build-"));
  execFileSync("npx", ["eleventy", "--output", out], { stdio: "pipe" });
  walk(out, (f) => f.endsWith(".html") && pages.push(f));
});

after(() => fs.rmSync(out, { recursive: true, force: true }));

test("builds a page for every recipe", () => {
  for (const { slug } of recipeFiles()) {
    assert.ok(
      exists(`recipes/${slug}/index.html`),
      `src/recipes/${slug}.md produced no page`,
    );
  }
  assert.ok(
    pages.length > recipeFiles().length,
    "plus the wheel and easter egg",
  );
});

test("recipe-index.json is exactly what the wheel expects", () => {
  // This file is the contract between the build and the wheel: the wheel draws
  // one sector per entry and navigates to its slug.
  const index = JSON.parse(read("recipe-index.json"));

  const expected = recipeFiles()
    .map(({ file, slug }) => {
      const data = frontMatter(file);
      // The label falls back to the title, which is the documented behaviour of
      // the optional wheelLabel override.
      return { slug, label: data.wheelLabel || data.title };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // Sorted by title, so sector order never depends on file dates.
  const byTitle = recipeFiles()
    .map(({ file, slug }) => ({ slug, title: frontMatter(file).title }))
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((r) => r.slug);

  assert.deepEqual(
    index.map((r) => r.slug),
    byTitle,
    "entries must be in title order",
  );
  assert.equal(index.length, expected.length);
  for (const entry of index) {
    const match = expected.find((e) => e.slug === entry.slug);
    assert.ok(match, `${entry.slug} is in the index but not in src/recipes`);
    assert.equal(entry.label, match.label, `wrong label for ${entry.slug}`);
    assert.ok(
      exists(`recipes/${entry.slug}/index.html`),
      `${entry.slug} has no page`,
    );
  }
});

test("every asset every page references actually exists", () => {
  // The check that would have caught a bad path during the restructure. A
  // missing stylesheet or script is invisible in the build log.
  let checked = 0;
  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    for (const [, url] of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      if (url.endsWith("/")) continue; // a page link, not a file
      checked++;
      assert.ok(exists(url), `${page} references missing ${url}`);
    }
  }
  assert.ok(checked > 20, `only ${checked} asset references found`);
});

test("every page loads the stylesheet defining the classes it uses", () => {
  // The stylesheet is split per page, so a class can land in a sheet the page
  // never loads -- silently unstyled, and nothing else would notice.
  const sheets = new Map();
  for (const file of fs.readdirSync(path.join(out, "assets/css"))) {
    const css = read(`assets/css/${file}`).replace(/\/\*[\s\S]*?\*\//g, "");
    const names = new Set();
    for (const [, selector] of css.matchAll(/([^{}]+)\{[^{}]*\}/g))
      for (const [, name] of selector.matchAll(/[.#]([A-Za-z0-9_-]+)/g))
        names.add(name);
    sheets.set(file.replace(/\.css$/, ""), names);
  }
  const styledAnywhere = new Set([...sheets.values()].flatMap((s) => [...s]));

  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    const loaded = [...html.matchAll(/assets\/css\/([a-z-]+)\.css/g)].map(
      (m) => m[1],
    );
    const available = new Set(
      loaded.flatMap((n) => [...(sheets.get(n) ?? [])]),
    );

    const used = new Set();
    for (const [, list] of html.matchAll(/class="([^"]*)"/g))
      list
        .split(/\s+/)
        .filter(Boolean)
        .forEach((c) => used.add(c));
    for (const [, id] of html.matchAll(/id="([^"]*)"/g)) used.add(id);

    for (const name of used) {
      if (!styledAnywhere.has(name)) continue; // not styled at all, fine
      assert.ok(
        available.has(name),
        `${page} uses .${name} but loads only [${loaded}]`,
      );
    }
  }
});

test("every module's imports resolve in the output", () => {
  // Modules import siblings by relative path; moving one without the other
  // breaks the page with nothing to show for it at build time.
  const dir = path.join(out, "assets/js");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mjs"));
  assert.ok(files.length > 0);

  for (const file of files) {
    const source = fs.readFileSync(path.join(dir, file), "utf8");
    for (const [, spec] of source.matchAll(/from\s+"(\.[^"]+)"/g)) {
      assert.ok(
        fs.existsSync(path.resolve(dir, spec)),
        `${file} imports ${spec}, which is not in the build`,
      );
    }
  }
});

test("the archived recipes are not published", () => {
  // They live outside src/ so this should be impossible, which is exactly why
  // it's worth asserting rather than assuming.
  assert.ok(!exists("recipes_out-of-rotation"));
  const archived = fs
    .readdirSync("recipes-archive")
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
  assert.ok(archived.length > 0, "there should be something in the archive");
  for (const slug of archived) {
    assert.ok(
      !exists(`recipes/${slug}/index.html`),
      `${slug} leaked into the build`,
    );
  }
});

test("the easter egg page lists photos that are really there", () => {
  const html = read("easter-egg/index.html");
  const attr = html.match(/data-photos="([^"]*)"/)[1].replace(/&quot;/g, '"');
  const photos = JSON.parse(attr);

  const onDisk = fs
    .readdirSync("src/assets/images/easter-egg")
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
  assert.equal(
    photos.length,
    onDisk.length,
    "every photo makes it into the page",
  );
  for (const url of photos) {
    assert.ok(exists(url), `the page offers ${url}, which is not in the build`);
  }
});

test("every page carries the viewport meta", () => {
  // Its absence is what made the wheel wobble and rescale on a phone.
  for (const page of pages) {
    assert.match(
      fs.readFileSync(page, "utf8"),
      /<meta name="viewport" content="width=device-width/,
      `${page} has no viewport meta`,
    );
  }
});

test("recipe pages carry the hooks their script depends on", () => {
  // recipe.mjs finds ingredients by walking .recipe headings and unhides
  // #reset_ingredients. Renaming either in the layout would break the checklist
  // with no error anywhere.
  const html = read(`recipes/${recipeFiles()[0].slug}/index.html`);
  assert.match(html, /<main class="recipe">/);
  assert.match(html, /id="reset_ingredients"[^>]*hidden/);
  assert.match(html, /<script type="module" src="[^"]*recipe\.mjs"/);
});

test("fractions are rendered in the built pages", () => {
  // Proves the markdown hook is actually wired into the build, not merely
  // correct when called directly.
  const withFraction = recipeFiles().find(({ file }) =>
    /(?<![\d/.])\d+\/\d+(?![\d/.])/.test(fs.readFileSync(file, "utf8")),
  );
  assert.ok(withFraction, "no recipe contains a fraction to check");
  const html = read(`recipes/${withFraction.slug}/index.html`);
  assert.match(
    html,
    /[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞]/u,
    `${withFraction.slug} has a fraction in source but none rendered`,
  );
});

test("the wheel page carries the search box and its script", () => {
  // search.mjs finds these three by id; renaming one in the markup would break
  // the search with nothing to show for it.
  const html = read("index.html");
  assert.match(html, /id="recipe_search_box"/);
  assert.match(html, /id="recipe_search"/);
  assert.match(html, /id="search_results"[^>]*hidden/);
  assert.match(html, /<script type="module" src="[^"]*search\.mjs"/);
  // The placeholder is what :placeholder-shown keys off; without it the empty
  // state would never swap back to search.png.
  assert.match(html, /id="recipe_search"[\s\S]{0,200}?placeholder=" "/);
});

test("both search box images ship and both states are styled", () => {
  const css = read("assets/css/wheel.css");

  // Resting state: the outline with the word in it.
  assert.match(css, /\.search_input\s*\{[^}]*search\.png/);
  // Focused, or holding text: the outline with no word, so typing doesn't land
  // on top of the lettering.
  assert.match(css, /:focus[\s\S]{0,120}?search_no_words\.png/);
  assert.match(css, /:not\(:placeholder-shown\)/);

  // Both files are really there, at the path the stylesheet asks for.
  for (const [, ref] of css.matchAll(/url\("([^"]+)"\)/g)) {
    const resolved = path.resolve(path.join(out, "assets/css"), ref);
    assert.ok(fs.existsSync(resolved), `wheel.css references missing ${ref}`);
  }
  assert.ok(exists("assets/images/ui/search.png"));
  assert.ok(exists("assets/images/ui/search_no_words.png"));
});

test("the whole site is set in one font, declared once", () => {
  // "Everywhere" is the kind of thing that quietly becomes "almost everywhere"
  // when someone adds a component with its own font-family.
  const base = read("assets/css/base.css");
  assert.match(
    base,
    /--font:\s*"Comic Sans MS"/,
    "base.css should define the typeface",
  );
  assert.match(base, /body\s*\{[^}]*font-family:\s*var\(--font\)/);
  // Inputs and buttons get browser fonts unless told otherwise.
  assert.match(base, /input[\s\S]{0,40}button\s*\{[^}]*font-family:\s*inherit/);

  // No stylesheet may name a typeface of its own.
  for (const file of fs.readdirSync(path.join(out, "assets/css"))) {
    const css = read(`assets/css/${file}`).replace(/\/\*[\s\S]*?\*\//g, "");
    for (const [, declared] of css.matchAll(/font-family:\s*([^;}]+)/g)) {
      assert.match(
        declared.trim(),
        /^(var\(--font\)|inherit)$/,
        `${file} sets its own font-family: ${declared.trim()}`,
      );
    }
    // The `font:` shorthand would smuggle one in too.
    for (const [, shorthand] of css.matchAll(/[^-]font:\s*([^;}]+)/g)) {
      assert.equal(
        shorthand.trim(),
        "inherit",
        `${file} sets a font shorthand: ${shorthand.trim()}`,
      );
    }
  }
});

test("the wheel's sector labels use the page font", () => {
  // The canvas does not inherit CSS, so this is the one place the font could
  // silently stay behind when the stylesheet changes.
  const wheel = fs.readFileSync(path.join(out, "assets/js/wheel.mjs"), "utf8");
  assert.match(
    wheel,
    /getComputedStyle\(document\.body\)\.fontFamily/,
    "wheel.mjs should take its canvas font from the page",
  );
  assert.doesNotMatch(
    wheel,
    /\d+px ['"][A-Za-z]/,
    "wheel.mjs should not name a typeface of its own",
  );
});

test("no build-time paths leak into the output", () => {
  for (const page of pages) {
    const html = fs.readFileSync(page, "utf8");
    assert.doesNotMatch(html, /"\/?src\//, `${page} references a src/ path`);
  }
});
