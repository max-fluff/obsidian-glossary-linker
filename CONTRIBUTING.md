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

`npm test` runs everything. CI runs `npm run test:core` — the tests a push has to pass, which are the ones whose failure you cannot see for yourself: the cross-plugin contract, and whether the built bundle loads at all. The rest pin behaviour, and behaviour is what most commits are meant to change. The [Development](README.md#development) section explains how `src/` is laid out.

## Adding a language

Languages are plain modules in `src/shared/morphology/languages/`, which is the shared submodule — a language added there reaches both prose plugins at once. Copy `_template.js`, fill it in, and register it in `src/shared/morphology/builtin-languages.js`. See [`src/shared/morphology/languages/README.md`](src/shared/morphology/languages/README.md) for the contract and what each field does.

## The shared submodule

`src/shared/` is a git submodule shared with the three sibling linkers, and most of the interesting code lives there. Read [`src/shared/CONTRIBUTING.md`](src/shared/CONTRIBUTING.md) before changing anything under it: it has the architecture, the `api.linker` contract that lets the plugins coexist, the rules for menus, CSS and locales, and the order commits have to go in.

## Pull requests

- Keep changes focused and rebuild before committing so `main.js` matches `src/`.
- Match the surrounding style: small CommonJS modules, comments only where the reason isn't obvious from the code.
- Describe what changed and why in the PR.
