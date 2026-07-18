# Third-party notices

This plugin bundles JavaScript ports of third-party stemming algorithms. They live in the
shared submodule, under `src/shared/morphology/languages/`, where each port's own license
is noted in the file's header. Summarized below (see also the "Licenses & credits" section
of the README).

Note that the bundler strips comments from `main.js`, so the attribution notices travel in
the source files and in this document rather than in the built plugin.

- `ru.js` — Snowball Russian stemmer, BSD license.
- `en.js` — Porter (1980) stemmer, free use.
- `es.js`, `de.js`, `fr.js` — Apache Lucene UniNE light stemmers, Apache License 2.0
  (https://www.apache.org/licenses/LICENSE-2.0).
- `uk.js` — this project's own light stemmer, MIT.
