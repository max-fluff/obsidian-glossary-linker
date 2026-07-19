# Contributing

Thanks for taking an interest. Bug reports, language modules, and pull requests are all welcome.

## Reporting bugs and ideas

Open an [issue](https://github.com/max-fluff/obsidian-glossary-linker/issues). For a bug, say which Obsidian version you're on, what you did, and what you expected. A small note or screenshot that reproduces it helps a lot.

## Building

```
npm install      # once, installs esbuild
npm run build    # bundle src/ -> main.js
```

`main.js` is generated. Edit the modules in `src/` and rebuild — don't edit `main.js` by hand.

`npm test` runs everything. CI runs `npm run test:core`, which is deliberately almost nothing: that the plugin loads at all, and that a sibling built from a different commit of the submodule degrades instead of crashing. Those are the two things a push must not break and the two you cannot check for yourself. Everything else is logic — changing it is what most commits are for — and it should not have to argue with CI before you can push. The [Development](README.md#development) section explains how `src/` is laid out.

## Adding a language

Languages are plain modules in `src/shared/morphology/languages/`, which is the shared submodule — a language added there reaches both prose plugins at once. Copy `_template.js`, fill it in, and register it in `src/shared/morphology/builtin-languages.js`. See [`src/shared/morphology/languages/README.md`](src/shared/morphology/languages/README.md) for the contract and what each field does.

## The shared submodule

`src/shared/` is a git submodule shared with the three sibling linkers, and most of the interesting code lives there. Read [`src/shared/CONTRIBUTING.md`](src/shared/CONTRIBUTING.md) before changing anything under it: it has the architecture, the `api.linker` contract that lets the plugins coexist, the rules for menus, CSS and locales, and the order commits have to go in.

## Pull requests

- Keep changes focused and rebuild before committing so `main.js` matches `src/`.
- Match the surrounding style: small CommonJS modules, comments only where the reason isn't obvious from the code.
- Describe what changed and why in the PR.
