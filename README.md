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

## Original Wheel Spinner Code Credits
https://github.com/olimorris/spin-the-wheel

## Configure linting and pre commit hooks

```
pipx install pre-commit
pre-commit install
pre-commit run --all-files
```
