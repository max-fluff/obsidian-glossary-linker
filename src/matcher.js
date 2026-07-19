'use strict';

const { splitLines } = require('./shared/markdown');
const { createMatcher } = require('./shared/prose/matcher');

// Term index + matching engine. Mixed into the plugin prototype; the scan itself lives in
// shared/prose/matcher.js. A term is a whole note, identified by its title, with aliases
// from its frontmatter.
const core = createMatcher({
  idOf: (c) => c.canonical,
  selfIdOf: (c) => c.canonical,
  fieldsOf: (c) => ({ canonical: c.canonical }),
  // A single word on the excluded-words list never becomes a link, even when a term matches
  // it. Multi-word matches are left alone: "cell" being excluded should not stop "stem cell".
  accepts: (plugin, matched, token) =>
    !(matched.wc === 1 && token.keys.some((k) => plugin.excludeWordKeys.has(k))),
});

module.exports = Object.assign({}, core, {
  // Base form for collected aliases: the first claiming language wins (by priority).
  lemmaFor(word) {
    for (const lang of this.activeLanguages) {
      if (lang.match(word)) return lang.lemma ? lang.lemma(word) : word.toLowerCase();
    }
    return word.toLowerCase();
  },

  rebuildIndex() {
    // keysFor depends on languages + matchMode, so a rebuild must drop its cache.
    this.keysCache = new Map();
    const byKey = new Map();
    const canonicals = new Set();
    // Flat term list for the autocomplete prefix scan and the public API.
    const terms = [];
    const minTermLength = Math.max(1, this.settings.minTermLength || 1);
    const excludeTerms = new Set(splitLines(this.settings.excludeTerms).map((s) => s.toLowerCase()));
    this.excludeWordKeys = new Set();
    for (const w of splitLines(this.settings.excludeWords)) {
      for (const k of this.keysFor(w)) this.excludeWordKeys.add(k);
    }

    const files = this.app.vault.getMarkdownFiles().filter((f) => this.isGlossaryFile(f));
    for (const file of files) {
      const canonical = file.basename;
      const aliases = this.aliasesOf(file);
      // Keep the 'changed'-handler fingerprint in sync with what this rebuild
      // actually saw, so the next single-file edit compares against current data.
      this.aliasFingerprints.set(file.path, JSON.stringify(aliases));
      // An excluded title or alias drops the whole entry (vs. excludeWords, one word).
      if ([canonical, ...aliases].some((f) => excludeTerms.has(f.toLowerCase()))) continue;

      const forms = [canonical, ...aliases].filter((x) => typeof x === 'string' && x.trim());
      const target = { canonical, path: file.path };
      canonicals.add(canonical);
      terms.push({ canonical, path: file.path, aliases });

      for (const form of forms) {
        if (form.trim().length < minTermLength) continue;
        const entry = this.formEntry(form);
        if (!entry) continue;
        if (entry.wordCount === 1 && entry.words[0].keys.some((k) => this.excludeWordKeys.has(k))) continue;

        const matcher = Object.assign({ canonical, target }, entry);
        for (const k of entry.words[0].keys) {
          if (!byKey.has(k)) byKey.set(k, []);
          byKey.get(k).push(matcher);
        }
      }
    }
    this.index = { byKey, termCount: canonicals.size };
    this.terms = terms;
    this.notifyIndexChange();
  },
});
