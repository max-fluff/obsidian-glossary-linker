# Contributing

Thanks for taking an interest. Bug reports, language modules, and pull requests are all welcome.

## Reporting bugs and ideas

Open an [issue](https://github.com/max-fluff/obsidian-glossary-linker/issues). For a bug, say which Obsidian version you're on, what you did, and what you expected. A small note or screenshot that reproduces it helps a lot.

## Building

```
npm install      # once, installs esbuild
npm run build    # bundle src/ -> main.js
```

`main.js` is generated. Edit the modules in `src/` (or `languages/`) and rebuild — don't edit `main.js` by hand. The [Development](README.md#development) section explains how `src/` is laid out.

## Adding a language

Languages are plain modules in `languages/`. Copy `_template.js`, fill it in, and register it in `src/builtin-languages.js`. See [`languages/README.md`](languages/README.md) for the contract and what each field does.

## Pull requests

- Keep changes focused and rebuild before committing so `main.js` matches `src/`.
- Match the surrounding style: small CommonJS modules, comments only where the reason isn't obvious from the code.
- Describe what changed and why in the PR.
