# WhatsForDinner
Personal project to figure out what to eat for dinner.

Ideas for the project:
- Add full recipes to each meal
- add clickable links in each repipe if they exist online
- add photo of recipe card
- add tags to each meal
- filter things on the spinner wheel based on tags
- categorize meals by what meal time they are for (lunch, dinner, etc. wheel is dinner only by default)
- add users and a database
- host on aws
- add test suite
- Give a shopping list of what to get (export to phone)
- Be able to mark what ingredients are in the house and have that propogate on the website so one person thats home can mark the things we have and the person in the store can cross things off as they shop
    - Do this locally first, maybe with cookies

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
layout: recipe-layout.njk
---

## Ingredients

- ...

## Steps

1. ...
```

That's it — Eleventy builds it into its own page at `/recipes/tofu-tacos/` using
the same shared layout ([src/_includes/recipe-layout.njk](src/_includes/recipe-layout.njk))
as every other recipe, **and it gets its own sector on the wheel**. The recipes
folder is the single source of truth: the build writes a `recipe-index.json`
listing every recipe, and the wheel ([src/wheel.js](src/wheel.js)) generates its
sectors from that — assigning the two wheel colors in alternation, and padding
with a "Spin Again" sector when there's an odd number of recipes. No other code
needs to change.

Sectors are ordered alphabetically by `title`. If a title is too long to read on
a wheel sector, add an optional `wheelLabel:` to the frontmatter and the wheel
will use that instead.

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
