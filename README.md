# Glossary Linker

Highlights glossary terms in your notes **in any word form** (declensions, plurals), lets you **turn them into real links**, and **learns new aliases** from links you already made by hand. A spiritual successor to the discontinued Virtual Linker, adding morphology-aware matching so inflected word forms are found, not only exact spellings.

Ships as `main.js` + `manifest.json` + `styles.css`. The five default language modules are bundled into `main.js`, so it works as soon as it is installed; you can add or override languages by dropping files into a `languages/` folder next to it (see *Adding a language*). `main.js` is built from `src/` with esbuild (see *Development*).

## What it does

### Highlight terms in any word form
The term list is built from each glossary file's name plus its `aliases`. Matching words are found in the text even when inflected (`unit → units`, RU `юнит → юнита/юниту/юнитов`). It is multilingual: the engine is picked automatically by the word's script — Russian for Cyrillic, English for Latin (see below). Highlighting works in Reading view and in the editor (Live / On save). Multi-word terms (`Vision radius`, hyphenated `Flow-field`) are matched whole, longest match first.

In Reading view the highlights are **real internal links**, so they behave like ordinary `[[links]]`:
- **hover** shows the term's page preview (per your *Page Preview* settings — with or without Ctrl, same as any link);
- **click** opens the glossary note (Ctrl/Cmd+click — in a new tab);
- **right-click** opens a menu: *Turn into link*, *Turn all "…" into links*, *Open glossary note*, *Open in new tab*.

### Turn terms into real links
Commands for the current note / selection / all notes. A matching word is replaced with `[[Title|word]]` (the visible text stays exactly as in your note, the link points to the glossary title). An "only first match per note" option is available. **Changes are previewed before writing.**

### Collect aliases from links you made
Scans for `[[Term|some wording]]` links you wrote by hand. If `Term` is a glossary note and there is custom wording, that wording becomes a new alias for the term. By default it is reduced to a base form first (`[[fruit|fruits]] → fruit`). Aliases are added with case-insensitive de-duplication, and nothing is added if the word is already matched anyway. Run it as a command or automatically on save. **Previewed before writing.**

## Morphology and languages

Morphology is **modular**. Five language modules are **bundled in** by default; you can add new languages or override a built-in one by dropping a file into a `languages/` folder inside the plugin's folder (loaded at runtime). The core discovers all of them on load and shows toggles in settings (*Matching → Languages*). For each word, the keys from **every enabled language that claims it** are combined (so same-script languages like English/Spanish/German/French all contribute on a Latin word). If no language claims a word, it is matched exactly (lowercased), without morphology.

Five modules ship by default (all share the same shape — `match` / `keys` / `lemma`, see *Adding a language*):
- **`ru.js`** (Russian) — Porter stemmer (Snowball, public domain). Keys are the **union** of the Porter stem and an ending strip, dropping an over-short stem. This covers both hard cases: `юнит/юнитов` (the stemmer over-truncates to `юн`, the ending strip rescues `юнит`) and `рой/роем`; meanwhile `юный/юнга/юности` do **not** stick to `Юнит`.
- **`en.js`** (English) — Porter stemmer (Porter 1980, public domain): `units → unit`, `running → run`. This is why no separate "plural s" option is needed.
- **`es.js`** / **`de.js`** / **`fr.js`** (Spanish / German / French) — ports of the UniNE / Apache Lucene light stemmers (Apache License 2.0, J. Savoy): `unidades → unidad`, `Einheiten → einheit`, `chevaux → cheval`. Lighter than full Snowball but proven, and enough to link a term across its word forms.

> Enable only the languages your vault actually uses. Because same-script languages combine, leaving, say, German on in an English-only vault can occasionally over-stem a word.

The mode (`matchMode`) is a global switch for all languages: `stemmer` / `endingStrip` (light ending trim) / `exact`. The actual algorithm per mode comes from the language module.

### Script support — which languages fit this model

The matcher works on **whitespace/punctuation-separated words** and reduces each word by trimming endings. So a language module is a good fit when the script is **alphabetic with word separators and inflectional endings**:
- **Latin / Cyrillic / Greek** — full fit (the five bundled modules).
- **Hindi** (Devanagari) and similar Indic abugidas — good fit: words are space-separated and take suffixes, so a suffix-stripping module works just like `es`/`de`/`fr`.
- **Korean** (Hangul) — workable: words are space-separated, but grammatical particles attach to nouns (책 → 책을/책이); a module can strip those particles in `keys`.
- **Chinese / Japanese** — **not** a good fit out of the box: there are no spaces between words and no inflectional endings, so a whole run of characters becomes one token and "stemming" is meaningless. Matching these needs word segmentation / substring search, which is a different strategy than this plugin uses. An exact-match module (`keys` returns the word as-is) would still link whole-token terms, but not terms embedded inside longer compounds.

So "any language" splits into two cases. The large family — alphabetic scripts with word separators and suffix inflection (Latin, Cyrillic, Greek, Indic, Korean, …) — is already fully covered: just add a module, no core changes. The hard cases (spaceless CJK, root-and-pattern morphology like Arabic/Hebrew) would need a different matcher: a per-language `segment(text)` hook and substring/dictionary lookup in the core, which is a substantial change and intentionally out of scope here.

Word boundaries use Unicode classes (`\p{L}` with the `u` flag); matching is case-insensitive, the visible text keeps the casing from your note, and collected aliases are stored lowercased.

### Adding a language

1. Create a `languages/` folder inside the plugin's folder (`<vault>/.obsidian/plugins/glossary-linker/languages/`) if it does not exist, and drop a file `<id>.js` into it (e.g. `uz.js`). Using the same `id` as a built-in (`ru`/`en`/`es`/`de`/`fr`) overrides that built-in.
2. The file must export a module object:
   ```js
   'use strict';
   module.exports = {
     id: 'uz',                 // unique id
     name: 'Uzbek',            // display name
     priority: 0,              // higher = checked first when scripts collide
     match: (w) => /.../.test(w),         // claims the word (usually by script)
     keys: (word, mode) => [/* keys */],  // mode: 'stemmer' | 'endingStrip' | 'exact'
     lemma: (word) => '...',              // optional: base form for collected aliases
   };
   ```
   `keys()` must lowercase the word itself and return an array of comparison keys (for `exact` — `[word.toLowerCase()]`).
3. In settings press *Matching → Languages → **Reload*** (or restart the plugin) — the language appears in the list. Turn its toggle on.

No build step: a module is a plain CommonJS file, loaded via `vault.adapter` + `new Function`.

A module that fails to load or is missing a required field (`id`, `name`, `match`, `keys`) is not silently dropped — it is listed under *Languages* with a ⚠ error marker and the reason instead of a toggle, so a typo is easy to spot.

### Alias form when collecting (`aliasHarvestMode`)
- **`lemma`** (default) — reduce the wording to a base (dictionary) form: EN `boxes → box`, RU `роем → рой`, `юнитов → юнит`. RU soft-stem nouns (`боем → бой`) have a dedicated rule; irregular alternations may need a manual fix in the preview.
- **`literal`** — store the wording as written.
- **`both`** — store both.

## Commands (command palette, Ctrl+P)

- **Turn terms into links: this note / selection / all notes**
- **Collect aliases from links: this note / all notes**
- **Rebuild glossary index**

You can also turn a single word into a link from the right-click menu on a highlighted term (*Turn into link* / *Turn all "…" into links*).

## Settings

Settings are grouped into sections; each has a detailed description in the UI.

**Scope**
| Setting | Default | Description |
|---|---|---|
| **Glossary folder** | `glossary` | folder with the term notes (created automatically when aliases are written if it is missing) |
| **Link scope** | `Listed folders only` | `Listed folders only` / `Everywhere except listed` / `Everywhere` |
| **Folders to include/exclude** | `design, architecture, features, guides, vision` | folder list; meaning depends on the mode; shown only when the mode is not "Everywhere" |
| **Always-excluded folders** | `_meta, _attachments, .obsidian` | always out of scope, on top of any mode |

**Matching**
| Setting | Default | Description |
|---|---|---|
| **Morphology** | `Stemmer` | mode for all languages: stemmer / ending strip / exact match |
| **Languages** | all discovered on | toggles for discovered language modules + a *Reload* button |
| **Link first occurrence only** | off | link only the first occurrence of each term per page |
| **Excluded terms** | — | term titles dropped from the index entirely |
| **Excluded words** | — | homonym words that must not trigger linking |

**Highlighting**
| Setting | Default | Description |
|---|---|---|
| **Highlight in Reading view** | on | highlight in Reading view |
| **Highlight while editing** | `Live` | editor highlighting: `Off` / `Live (as you type)` / `On save`; applied immediately, no reload |
| **Skip headings** | on | do not link inside headings (`#`) |

**Collecting aliases**
| Setting | Default | Description |
|---|---|---|
| **Alias form** | `Base form` | how link text is stored: base form / as written / both |
| **Collect on save** | `Off` | `Off` / `Silent (add automatically)` / `Ask first` — collect aliases on save (with a short delay) |
| **Single-word aliases only** | on | collect single-word link texts only (multi-word ones reduce poorly) |
| **Minimum alias length** | `2` | ignore aliases shorter than N characters |

## Skipped contexts

Code blocks (``` and `~~~`), inline code, frontmatter, existing `[[...]]` and `[..](..)` links, and URLs are left untouched. A term is never linked inside its own note. In Reading view, links and (optionally) headings are additionally skipped by DOM ancestry; in the editor, by the CM6 syntax tree.

## Performance

The index is built on load and rebuilt when glossary notes change (debounced). Word-form keys are cached in the index; scanning is token-based with longest-match-first.

## Licenses & credits

The bundled language modules port well-known, permissively-licensed stemming algorithms. All are free for **commercial and non-commercial** use; the only obligation is keeping the attribution notices (already in each file's header).

| Module | Algorithm | License | Reference |
|---|---|---|---|
| `ru.js` | Snowball Russian stemmer (Porter framework) | BSD (© 2001–2006 M. Porter & R. Boulton) | [snowballstem.org](https://snowballstem.org/algorithms/russian/stemmer.html) · [license](https://snowballstem.org/license.html) |
| `en.js` | Porter stemmer (M. F. Porter, 1980) | Free use, released by the author | [tartarus.org](https://tartarus.org/martin/PorterStemmer/) |
| `es.js` | Apache Lucene `SpanishLightStemmer` (UniNE, J. Savoy) | Apache License 2.0 | [source](https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/es/SpanishLightStemmer.java) |
| `de.js` | Apache Lucene `GermanLightStemmer` (UniNE, J. Savoy) | Apache License 2.0 | [source](https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/de/GermanLightStemmer.java) |
| `fr.js` | Apache Lucene `FrenchLightStemmer` (UniNE, J. Savoy) | Apache License 2.0 | [source](https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/fr/FrenchLightStemmer.java) |

The es/de/fr stemmers were translated to JavaScript and adapted to this plugin's module interface; per the Apache License the source files note that they are modified ports. Apache 2.0 full text: <https://www.apache.org/licenses/LICENSE-2.0>.

## Development

The core is written as small CommonJS modules in `src/` and bundled into `main.js` by esbuild. The default language modules in `languages/` are bundled in via `src/builtin-languages.js`; a user can still add or override languages at runtime by placing files in a `languages/` folder next to the installed plugin.

```
npm install      # once, installs esbuild
npm run build    # bundle src/ -> main.js
```

`src/` layout:
- `main.js` — the `Plugin` class: lifecycle, commands, language loading, scope, small shared helpers; applies the mixins below.
- `constants.js` — default settings.
- `builtin-languages.js` — requires the modules in `languages/` so they are bundled into `main.js`.
- `matcher.js` — the term index and matching engine (`keysFor`, `tokenizeForm`, `rebuildIndex`, `findMatches`, protected ranges).
- `highlight.js` — Reading-view DOM highlighting and the CM6 editor extension.
- `actions.js` — turning terms into links + collecting aliases.
- `modals.js` — the two preview dialogs. `settings-tab.js` — the settings UI.

`main.js` is generated; edit `src/` (or `languages/`) and rebuild rather than editing `main.js` directly. `node_modules/` and `package-lock.json` are git-ignored.

## Installation

**Manually:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/max-fluff/obsidian-glossary-linker/releases) into `<vault>/.obsidian/plugins/glossary-linker/`, then enable the plugin in *Settings → Community plugins*. The default languages are baked into `main.js`, so nothing else is needed.

**Via [BRAT](https://github.com/TfTHacker/obsidian42-brat):** add the repository `max-fluff/obsidian-glossary-linker`.

Once accepted into the community catalog it will also be installable from *Settings → Community plugins → Browse*.
