'use strict';

const { splitLines } = require('./shared/markdown');
const { createMatcher } = require('./shared/prose/matcher');

// Term index + matching engine. Mixed into the plugin prototype; the scan itself lives in
// shared/prose/matcher.js. A term is a note: `canonical` is its title, `linktext` what
// addresses it — the title while it names one note, its path once two notes share it.
const core = createMatcher({
  idOf: (c) => c.linktext,
  selfIdOf: (c) => c.linktext,
  fieldsOf: (c) => ({ canonical: c.canonical, linktext: c.linktext }),
  // A single word on the excluded-words list never becomes a link, even when a term matches
  // it. Multi-word matches are left alone: "cell" being excluded should not stop "stem cell".
  accepts: (plugin, matched, token) => !(matched.wc === 1 && plugin.wordSilenced(token.raw)),
});

module.exports = Object.assign({}, core, {
  // Whether the excluded-words list silences this written word — by its own spelling, or
  // through a starred line standing for a stem and every form that reduces to it.
  wordSilenced(word) {
    if (this.excludedWords.has(word.toLowerCase())) return true;
    return this.excludedStems.size > 0 && this.keysFor(word).some((k) => this.excludedStems.has(k));
  },

  // Base form for collected aliases: the first claiming language that has one wins. A
  // language without lemma() is skipped — Latin claims all Latin script and would answer
  // for English, dropping the harvest to the literal form.
  lemmaFor(word) {
    for (const lang of this.activeLanguages) {
      if (lang.match(word) && lang.lemma) return lang.lemma(word);
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
    this.excludedWords = new Set();
    this.excludedStems = new Set();
    for (const line of splitLines(this.settings.excludeWords)) {
      if (!line.endsWith('*')) { this.excludedWords.add(line.toLowerCase()); continue; }
      // Reduced rather than stored as typed, so a starred line works whether the reader wrote
      // the stem or any form of it.
      for (const k of this.keysFor(line.slice(0, -1))) this.excludedStems.add(k);
    }

    const files = this.app.vault.getMarkdownFiles().filter((f) => this.isGlossaryFile(f));
    const titles = new Map();
    for (const file of files) titles.set(file.basename, (titles.get(file.basename) || 0) + 1);

    for (const file of files) {
      const canonical = file.basename;
      const linktext = titles.get(canonical) > 1 ? file.path.replace(/\.md$/, '') : canonical;
      const aliases = this.aliasesOf(file);
      // Keep the 'changed'-handler fingerprint in sync with what this rebuild
      // actually saw, so the next single-file edit compares against current data.
      this.aliasFingerprints.set(file.path, JSON.stringify(aliases));
      // An excluded title or alias drops the whole entry (vs. excludeWords, one word).
      if ([canonical, ...aliases].some((f) => excludeTerms.has(f.toLowerCase()))) continue;

      const forms = [canonical, ...aliases].filter((x) => typeof x === 'string' && x.trim());
      canonicals.add(canonical);
      terms.push({ canonical, linktext, path: file.path, aliases });

      for (const form of forms) {
        if (form.trim().length < minTermLength) continue;
        const entry = this.formEntry(form);
        if (!entry) continue;

        const matcher = Object.assign({ canonical, linktext }, entry);
        for (const k of entry.words[0].keys) {
          if (!byKey.has(k)) byKey.set(k, []);
          byKey.get(k).push(matcher);
        }
      }
    }
    this.index = { byKey, termCount: canonicals.size };
    this.terms = terms;
    // Bumped so the usage/candidate caches drop results scanned against the old term set.
    this.indexVersion = (this.indexVersion || 0) + 1;
    this.notifyIndexChange();
  },
});
