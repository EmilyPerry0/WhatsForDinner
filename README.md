# WhatsForDinner
Personal project to figure out what to eat for dinner.

Ideas for the project:
- Have a spinner wheel that can randomly choose one meal in the database.
- Add full recipes to each meal
- add clickable links in each repipe if they exist online
- add photo of recipe card
- add tags to each meal
- filter things on the spinner wheel based on tags
- categorize meals by what meal time they are for (lunch, dinner, etc. wheel is dinner only by default)
- add users and a database
- host on aws
- add test suite
- add linting and hooks
- Give a shopping list of what to get (export to phone)

## Building the site

The site is built with [Eleventy](https://www.11ty.dev/): everything in `src/`
gets built into static HTML in `dist/`.

```
npm install
npm run serve   # local dev server with live reload, http://localhost:8080
npm run build   # one-off build to dist/
```

### Adding a new recipe

Add a file to `src/recipes/`, e.g. `src/recipes/tofu-tacos.md`:

```md
---
title: Tofu Tacos
wheelLabel: Tofu Tacos
layout: recipe-layout.njk
---

## Ingredients

- ...

## Steps

1. ...
```

That's it — Eleventy builds it into its own page at `/recipes/tofu-tacos/`
using the same shared layout ([src/_includes/recipe-layout.njk](src/_includes/recipe-layout.njk))
as every other recipe, and the wheel ([src/wheel.js](src/wheel.js)) automatically
links the matching sector to it once `wheelLabel` matches that sector's label
in the `sectors` list — no other code needs to change.

If you deploy this under a subpath (e.g. a GitHub Pages project site at
`username.github.io/WhatsForDinner/`), build with
`npx eleventy --pathprefix=WhatsForDinner` so the generated links account for it.

## Original Wheel Spinner Code Credits
https://github.com/olimorris/spin-the-wheel

## Configure linting and pre commit hooks

```
pipx install pre-commit
pre-commit install
pre-commit run --all-files
```
