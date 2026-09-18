// Which recipes a search box query should offer. Kept pure and apart from the DOM
// so the tests can drive it directly.

// Case-insensitive substring against the recipe's name. Deliberately not ranked
// or fuzzy: with seventeen recipes, predictable beats clever, and matches come
// back in the order they arrived -- already alphabetical, since the build sorts
// recipe-index.json by title.
export function matchRecipes(recipes, query) {
  if (!Array.isArray(recipes)) return [];

  const needle = String(query ?? "")
    .trim()
    .toLowerCase();
  // An empty box offers nothing, which is what keeps the list closed until
  // somebody actually types.
  if (!needle) return [];

  return recipes.filter((recipe) =>
    String(recipe?.label ?? "")
      .toLowerCase()
      .includes(needle),
  );
}
