# Glossary Linker

Highlights glossary terms in your notes in any word form (declensions, plurals), lets you turn them into real links, and learns new aliases from links you already made by hand. It's a take on the discontinued Virtual Linker, with morphology-aware matching so inflected forms are found, not only exact spellings.

Ships as `main.js` + `manifest.json` + `styles.css`. Six language modules are bundled into `main.js`, so it works as soon as it's installed; more languages can be contributed as modules (see *Adding a language*). `main.js` is built from `src/` with esbuild (see *Development*).

## What it does

### Highlight terms in any word form
The term list is built from each glossary file's name plus its `aliases`. Matching words are found even when inflected (`unit → units`, RU `юнит → юнита/юниту/юнитов`). It's multilingual: the engine is picked automatically by the word's script — Russian for Cyrillic, English for Latin (see below). Highlighting works in Reading view and in the editor (Live / On save). Multi-word terms (`Vision radius`, hyphenated `Flow-field`) are matched whole, longest match first.

In Reading view the highlights are real internal links, so they behave like ordinary `[[links]]`:
- hover shows the term's page preview (per your *Page Preview* settings, with or without Ctrl, same as any link);
- click opens the glossary note (Ctrl/Cmd+click for a new tab);
- right-click opens a menu: *Turn into link*, *Turn all "…" into links: this note*, *Turn all "…" into links: all notes*, *Add "…" to excluded words*, *Add "…" to excluded terms*, *Open glossary note*, *Open in new tab*. Each group can be hidden under *Settings → Context menu* (with all off, right-click just shows the native menu).

### Turn terms into real links
Commands for the current note / selection / all notes. A matching word is replaced with `[[Title|word]]`: the visible text stays exactly as in your note, the link points to the glossary title. There's an "only first match per note" option. Changes are previewed before writing.

### Collect aliases from links you made
Scans for `[[Term|some wording]]` links you wrote by hand. If `Term` is a glossary note and the wording is custom, that wording becomes a new alias for the term. By default it's reduced to a base form first (`[[fruit|fruits]] → fruit`). Aliases are de-duplicated case-insensitively, and nothing is added if the word already matches anyway. Run it as a command or automatically on save. Previewed before writing — each alias has a checkbox, aliases that would collide with another term are flagged with ⚠, and candidates skipped because they already exist are listed separately.

### Suggest links as you type (optional)
With *Autocomplete → Suggest links while typing* on, typing in an in-scope note offers to insert a `[[link]]` to a matching glossary term — either a prefix of a term's title/alias (type `Vis` → *Vision radius*) or an inflected form of it. Picking a prefix match inserts `[[Term]]`; picking an inflected form keeps your wording as `[[Term|word]]`. Off by default; it never triggers inside the glossary folder, code, links or other protected spans.

### Ambiguous terms
When a word matches more than one glossary term (the same alias on two notes), it gets a distinct (wavy) underline; hovering shows a tooltip listing all the matching terms rather than a single (misleading) page preview. Acting on it — clicking to open, or *Turn into link* / *Open* from the right-click menu — pops a small picker so you choose which term, instead of silently following the first. A word that matches a single term acts immediately as usual.

## Morphology and languages

Morphology is modular. Five language modules are bundled in by default; more can be added as modules and rebuilt (see *Adding a language*). Each is validated against the module contract on load and gets a toggle in settings (*Matching → Languages*). For each word, the keys from every enabled language that claims it are combined, so same-script languages like English/Spanish/German/French all contribute on a Latin word. If no language claims a word, it's matched exactly (lowercased), without morphology.

The built-in modules are stemmer code bundled into the plugin:
- `ru.js` (Russian) — Porter stemmer (Snowball, public domain). Keys are the union of the Porter stem and an ending strip, dropping an over-short stem. This covers both hard cases: `юнит/юнитов` (the stemmer over-truncates to `юн`, the ending strip rescues `юнит`) and `рой/роем`, while `юный/юнга/юности` don't stick to `Юнит`.
- `uk.js` (Ukrainian) — the plugin's own light stemmer, with the о/і and е/і vowel alternation in closed syllables (`кіт/кота`, `ніч/ночі`). A small worked example of the module contract.
- `en.js` (English) — Porter stemmer (Porter 1980, public domain): `units → unit`, `running → run`. This is why no separate "plural s" option is needed.
- `es.js` / `de.js` / `fr.js` (Spanish / German / French) — ports of the UniNE / Apache Lucene light stemmers (Apache License 2.0, J. Savoy): `unidades → unidad`, `Einheiten → einheit`, `chevaux → cheval`. Lighter than full Snowball but enough to link a term across its word forms.

> Enable only the languages your vault actually uses. Because same-script languages combine, leaving German on in an English-only vault can occasionally over-stem a word. On first run the plugin enables only English plus your Obsidian interface language (if a module exists for it); turn on any others you need.

The mode (`matchMode`) is a global switch for all languages: `stemmer` / `endingStrip` (light ending trim) / `exact`. The actual algorithm per mode comes from the language module.

### Script support — which languages fit this model

The matcher works on whitespace/punctuation-separated words and reduces each word by trimming endings. So a language module is a good fit when the script is alphabetic with word separators and inflectional endings:
- Latin / Cyrillic / Greek — full fit (the bundled modules).
- Hindi (Devanagari) and similar Indic abugidas — good fit: words are space-separated and take suffixes, so a suffix-stripping module works just like `es`/`de`/`fr`.
- Korean (Hangul) — workable: words are space-separated, but grammatical particles attach to nouns (책 → 책을/책이); a module can strip those particles in `keys`.
- Chinese / Japanese — not a good fit out of the box: there are no spaces between words and no inflectional endings, so a whole run of characters becomes one token and stemming is meaningless. Matching these needs word segmentation / substring search, a different strategy than this plugin uses. An exact-match module (`keys` returns the word as-is) would still link whole-token terms, but not terms embedded inside longer compounds.

So "any language" splits into two cases. Alphabetic scripts with word separators and suffix inflection (Latin, Cyrillic, Greek, Indic, Korean, …) are a natural fit: add a module, no core changes. The hard cases (spaceless CJK, root-and-pattern morphology like Arabic/Hebrew) would need a different matcher — a per-language `segment(text)` hook and substring/dictionary lookup in the core — which is out of scope here.

Word boundaries use Unicode classes (`\p{L}` with the `u` flag); matching is case-insensitive, the visible text keeps the casing from your note, and collected aliases are stored lowercased.

### Adding a language

A language is a small JavaScript module, bundled into `main.js` at build time — nothing is loaded or executed at runtime. Adding one means contributing a module and rebuilding, via a pull request. The full contract, an annotated template, and a step-by-step guide live in [`languages/README.md`](languages/README.md); the short version:

1. Copy [`languages/_template.js`](languages/_template.js) to `languages/<id>.js` (e.g. `uk.js`). A module exports `id`, `name`, `match(word)` and `keys(word, mode)`, plus optional `priority` and `lemma(word)`. Reusing a built-in `id` (`ru`/`uk`/`en`/`es`/`de`/`fr`) overrides it.
2. Implement `match` (claims a word, usually by script) and `keys` (returns the comparison keys for a word in the current mode — `stemmer` / `endingStrip` / `exact`). Two words link when their key sets overlap.
3. Register the module in [`src/builtin-languages.js`](src/builtin-languages.js) and run `npm run build`.
4. Restart the plugin — the language appears under *Matching → Languages*. Turn its toggle on.

Each module is validated against the contract on load (`src/language-api.js`). A module that does not export an object with a valid `id` / `name` / `match` / `keys` is dropped and listed under *Languages* with a ⚠ marker and the reason, instead of breaking the index — so a mistake is easy to spot.

### Alias form when collecting (`aliasHarvestMode`)
- **`lemma`** (default) — reduce the wording to a base (dictionary) form: EN `boxes → box`, RU `роем → рой`, `юнитов → юнит`. RU soft-stem nouns (`боем → бой`) have a dedicated rule; irregular alternations may need a manual fix in the preview.
- **`literal`** — store the wording as written.
- **`both`** — store both.

## Commands (command palette, Ctrl+P)

- **Turn terms into links: this note / selection / all notes**
- **Collect aliases from links: this note / all notes**
- **Create glossary term from selection** — creates a note in the glossary folder named after the selected text and links the selection to it
- **Rebuild glossary index**

You can also act on a highlighted term from its right-click menu: *Turn into link*, *Turn all "…" into links: this note*, *Turn all "…" into links: all notes* (the last previews changes across the whole vault), plus *Add "…" to excluded words* / *Add "…" to excluded terms* to quickly suppress a false match. Right-clicking on a plain text **selection** offers *Glossary: create term & link* (create the term note and replace the selection with a link), *Glossary: create term* (just create and open it), and *Glossary: add "…" to excluded words* (suppress that word, term or not). Right-clicking anywhere else in the editor (empty space or a link) offers *Glossary: collect aliases from links (this note)*. Each of these groups can be toggled off under *Settings → Context menu*.

A status-bar counter (e.g. `3 terms`) shows how many glossary terms are on the current note — plain-text mentions plus, optionally, terms already linked directly; click it to turn this note's terms into links (toggles under *Highlighting → Status bar count*).

## Settings

Settings are grouped into sections, each with a short description in the UI; the tables below carry the full details and tips.

**Scope**
| Setting | Default | Description |
|---|---|---|
| **Glossary folder** | `glossary` | folder with the term notes (created automatically when aliases are written if it is missing); has folder autocomplete, and shows a warning / indexed-term count below it |
| **Link scope** | `Everywhere` | `Listed folders only` / `Everywhere except listed` / `Everywhere` |
| **Folders to include/exclude** | — | folder list; meaning depends on the mode; shown only when the mode is not "Everywhere" |
| **Always-excluded folders** | — | always out of scope, on top of any mode |

**Matching**
| Setting | Default | Description |
|---|---|---|
| **Morphology** | `Stemmer` | how an inflected word is matched: `Stemmer` reduces words to a root (units → unit, recommended); `Ending strip` only chops common endings (lighter); `Exact match` needs the exact spelling. The algorithm itself comes from the enabled language modules |
| **Languages** | English + interface language | per-language toggle; reorder with ↑↓ to set priority (higher in the list wins when same-script languages overlap, deciding the lemma); on first run only English and your Obsidian interface language are enabled |
| **Link first occurrence only** | off | link only the first occurrence of each term per page |
| **Excluded terms** | — | term titles or aliases that drop the whole matching entry from the index; a shared alias (e.g. `_toc` on every index/MOC note) drops them all at once. Use *Excluded words* to suppress a single word |
| **Excluded words** | — | surface words (and their inflections) that never trigger a link even if they match a term — for homonyms, e.g. a common word "lead" colliding with a term "Lead" |

**Highlighting**
| Setting | Default | Description |
|---|---|---|
| **Highlight in Reading view** | on | underline detected terms as clickable links in Reading view (file unchanged); they behave like real links — hover preview, click to open, right-click for the actions menu |
| **Highlight while editing** | `Live` | editor highlighting: `Off` / `Live (as you type)` / `On save`; applied immediately, no reload |
| **Skip headings** | on | do not link inside headings (`#`) |
| **Status bar count** | on | show the count of terms on the current note (e.g. `3 terms`) in the status bar; the base count is plain-text (not-yet-linked) mentions; click it to link them |
| **Count direct links** | on | also count terms already linked directly (`[[Term]]` / `[[Term\|alias]]`), not just plain-text mentions |

The highlight's color and underline (and the ambiguous-term underline) are exposed to the [Style Settings](https://github.com/mgmeyers/obsidian-style-settings) plugin under a *Glossary Linker* section, so you can restyle them from a UI. Without Style Settings — or left at default — the highlight follows your theme's link color.

**Autocomplete**
| Setting | Default | Description |
|---|---|---|
| **Suggest links while typing** | off | offer a `[[link]]` to a matching term as you type in an in-scope note (prefix of a title/alias, or an inflected form); only triggers at the end of a word and only when there are matches |
| **Minimum characters** | `3` | how many characters to type before suggestions appear |

**Collecting aliases**
| Setting | Default | Description |
|---|---|---|
| **Alias form** | `Base form` | how link text is stored: `Base form` reduces it to a dictionary form so one alias covers many word forms ("boxes" → "box"; it is a stem, so it can be grammatically odd but still matches); `As written` keeps the exact text; `Both` stores both |
| **Collect on save** | `Off` | `Off` / `Silent (add automatically)` / `Ask first` — collect aliases on save (with a short delay) |
| **Single-word aliases only** | on | collect single-word link texts only (multi-word ones reduce poorly) |
| **Minimum alias length** | `2` | ignore aliases shorter than N characters |
| **Warn about alias collisions** | on | when collecting an alias or creating a term, flag wording that already matches a different term, so you don't make one word point at two terms |

**Context menu**
| Setting | Default | Description |
|---|---|---|
| **"Turn into links" items** | on | show the turn-into-link actions when right-clicking a term |
| **"Collect aliases" item** | on | show *Glossary: collect aliases from links (this note)* in the editor menu (empty space / a link) |
| **"Exclude word / term" items** | on | show *Add … to excluded words / terms* when right-clicking a term |
| **"Open glossary note" items** | on | show *Open glossary note* / *Open in new tab* when right-clicking a term (all groups off → native menu) |
| **"Create term from selection" items** | on | show the *Glossary: create term…* actions when right-clicking a selection |

## Skipped contexts

Code blocks (``` and `~~~`), inline code, frontmatter, existing `[[...]]` and `[..](..)` links, and URLs are left untouched. A term is never linked inside its own note. In Reading view, links and (optionally) headings are additionally skipped by DOM ancestry; in the editor, by the CM6 syntax tree. When a link is written into a Markdown table cell, the alias pipe is escaped (`[[Term\|word]]`) so the table is not broken.

In the editor the highlights behave like real internal links: a plain click places the cursor, Ctrl/Cmd+click follows the term, middle-click opens it in a new tab, and the hover preview honours your Page Preview modifier setting.

## Performance

The index is built on load and rebuilt when glossary notes change (debounced). Word-form keys are cached in the index, and per-word stemmer results are memoised across a render pass (invalidated on rebuild); scanning is token-based with longest-match-first. The editor's right-click menu reads the term straight from the clicked decoration instead of re-scanning the document.

## Public API

The plugin exposes a small read-only API at `app.plugins.plugins['glossary-linker'].api`, so other plugins and DataviewJS can query the glossary:

| Method | Returns |
|---|---|
| `getTerms()` | every indexed term: `{ canonical, path, aliases }` |
| `resolveTerm(name)` | the term a title or alias (case-insensitive) belongs to, or `null` |
| `keysFor(word)` / `lemmaFor(word)` | the morphology keys / base form of a word, same engine the matcher uses |
| `findMatches(text)` | glossary matches in arbitrary text (protected spans skipped) |
| `getUsageReport()` | async; per term, how many plain-text occurrences across in-scope notes and in which files — terms with `count: 0` are orphans |
| `onChange(cb)` | subscribe to index rebuilds; returns an unsubscribe function |

A "glossary dashboard" in DataviewJS, for example:

```js
const api = app.plugins.plugins['glossary-linker'].api;
const report = await api.getUsageReport();
dv.table(['Term', 'Uses'], report.sort((a, b) => b.count - a.count).map((r) => [r.canonical, r.count]));
// orphans:
dv.list(report.filter((r) => r.count === 0).map((r) => r.canonical));
```

## Licenses & credits

Most bundled language modules port well-known, permissively-licensed stemming algorithms (`uk.js` is the plugin's own, under its MIT license). All are free for commercial and non-commercial use; the only obligation is keeping the attribution notices (already in each file's header).

| Module | Algorithm | License | Reference |
|---|---|---|---|
| `ru.js` | Snowball Russian stemmer (Porter framework) | BSD (© 2001–2006 M. Porter & R. Boulton) | [snowballstem.org](https://snowballstem.org/algorithms/russian/stemmer.html) · [license](https://snowballstem.org/license.html) |
| `uk.js` | Light suffix stemmer with vowel alternation | MIT (this plugin) | — |
| `en.js` | Porter stemmer (M. F. Porter, 1980) | Free use, released by the author | [tartarus.org](https://tartarus.org/martin/PorterStemmer/) |
| `es.js` | Apache Lucene `SpanishLightStemmer` (UniNE, J. Savoy) | Apache License 2.0 | [source](https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/es/SpanishLightStemmer.java) |
| `de.js` | Apache Lucene `GermanLightStemmer` (UniNE, J. Savoy) | Apache License 2.0 | [source](https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/de/GermanLightStemmer.java) |
| `fr.js` | Apache Lucene `FrenchLightStemmer` (UniNE, J. Savoy) | Apache License 2.0 | [source](https://github.com/apache/lucene/blob/main/lucene/analysis/common/src/java/org/apache/lucene/analysis/fr/FrenchLightStemmer.java) |

The es/de/fr stemmers were translated to JavaScript and adapted to this plugin's module interface; per the Apache License the source files note that they are modified ports. Apache 2.0 full text: <https://www.apache.org/licenses/LICENSE-2.0>.

## Development

The core is written as small CommonJS modules in `src/` and bundled into `main.js` by esbuild. The language modules in `languages/` are bundled in via `src/builtin-languages.js`; adding a language means contributing a module there and rebuilding (see [`languages/README.md`](languages/README.md)). Nothing is loaded or executed at runtime.

```
npm install      # once, installs esbuild
npm run build    # bundle src/ -> main.js
```

`src/` layout:
- `main.js` — the `Plugin` class: lifecycle, commands, language loading, scope, small shared helpers; applies the mixins below.
- `constants.js` — default settings.
- `builtin-languages.js` — requires the modules in `languages/` so they are bundled into `main.js`.
- `language-api.js` — the language-module contract and `validateLanguage()`.
- `matcher.js` — the term index and matching engine (`keysFor`, `tokenizeForm`, `rebuildIndex`, `findMatches`, `termsMatchingText`, protected ranges).
- `highlight.js` — Reading-view DOM highlighting and the CM6 editor extension.
- `actions.js` — turning terms into links + collecting aliases.
- `api.js` — the public API mixin (`app.plugins.plugins['glossary-linker'].api`).
- `modals.js` — the preview dialogs and the confirm dialog. `settings-tab.js` — the settings UI.
- `folder-suggest.js` — folder autocomplete for the glossary-folder field (feature-detected).
- `term-suggest.js` — the editor autocomplete (`EditorSuggest`, feature-detected).

`main.js` is generated; edit `src/` (or `languages/`) and rebuild rather than editing `main.js` directly. `node_modules/` and `package-lock.json` are git-ignored.

## Installation

**Manually:** download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/max-fluff/obsidian-glossary-linker/releases) into `<vault>/.obsidian/plugins/glossary-linker/`, then enable the plugin in *Settings → Community plugins*. The default languages are baked into `main.js`, so nothing else is needed.

**Via [BRAT](https://github.com/TfTHacker/obsidian42-brat):** add the repository `max-fluff/obsidian-glossary-linker`.

Once accepted into the community catalog it will also be installable from *Settings → Community plugins → Browse*.
