'use strict';

const { Notice } = require('obsidian');
const { t } = require('./shared/i18n');
const { createProseProvider, aliasHit } = require('./shared/prose/provider');
const { createUsageCache, foldUsageInto, scanCandidateWords, aggregateCandidates } = require('./shared/prose/usage');
const { suggestionsFor } = require('./term-suggest');

// Public API exposed as `app.plugins.plugins['glossary-linker'].api`, so other
// plugins and DataviewJS can read the glossary index. Mixed into the plugin
// prototype; methods run with the plugin as `this`.
module.exports = {
  buildApi() {
    const plugin = this;
    return {
      version: this.manifest.version,

      // Every indexed term: { canonical, linktext, path, aliases }.
      getTerms: () => this.getTerms(),

      // Resolve a title or alias (case-insensitive) to its term, or null.
      resolveTerm: (name) => this.resolveTerm(name),

      // Morphology helpers (same engine the matcher uses).
      keysFor: (word) => this.keysFor(String(word || '')),
      lemmaFor: (word) => this.lemmaFor(String(word || '')),

      // Glossary matches in arbitrary text, skipping protected ranges.
      findMatches: (text) => this.findMatches(String(text || ''), null, { protect: true }),

      // Heavy: scans in-scope notes and counts occurrences per term. Call explicitly.
      getUsageReport: (opts) => this.getUsageReport(opts),

      // Heavy: frequent in-scope words that are not yet terms. Call explicitly.
      collectCandidates: (opts) => this.collectCandidates(opts),

      // Subscribe to index rebuilds; returns an unsubscribe function.
      onChange: (cb) => this.onIndexChange(cb),

      // The provider contract the sibling linkers read (consumed in shared/discover.js).
      linker: createProseProvider(plugin, {
        id: 'glossary-linker',
        displayName: 'Glossary Linker',
        spanOf: (m) => ({
          start: m.start,
          end: m.end,
          label: m.canonical,
          target: m.linktext,
          alts: (m.alts || []).map((linktext) => ({ label: plugin.labelFor(linktext), target: linktext })),
        }),
        suggestionsFor,
        excludes: (text) => plugin.wordSilenced(text) || plugin.isExcluded('excludeTerms', text),
        // The kind tells a term apart from a heading offered on the same word; the folder
        // tells two notes sharing a title apart from each other.
        describe: (target, display) => {
          const term = (plugin.terms || []).find((x) => x.linktext === target);
          const title = plugin.labelFor(target);
          const folder = term && term.linktext !== term.canonical ? term.path.split('/').slice(0, -1).join('/') : null;
          const parts = [t('kind.term'), aliasHit(plugin, term, title, display), folder];
          return { title, note: parts.filter(Boolean).join(' · ') };
        },
      }),
    };
  },

  getTerms() {
    return (this.terms || []).map((t) => this.termShape(t));
  },

  termShape(t) {
    return { canonical: t.canonical, linktext: t.linktext, path: t.path, aliases: t.aliases.slice() };
  },

  resolveTerm(name) {
    if (!name) return null;
    const q = String(name).toLowerCase();
    for (const t of this.terms || []) {
      if (t.canonical.toLowerCase() === q) return this.termShape(t);
      if (t.aliases.some((a) => a.toLowerCase() === q)) return this.termShape(t);
    }
    return null;
  },

  // Read one note for the usage report: how often each term appears in it as plain text,
  // plus, with includeLinks, its direct [[Term]] links. Cached per note by the harness.
  async usageInFile(file, includeLinks) {
    const here = new Map();
    try {
      const text = await this.app.vault.cachedRead(file);
      for (const m of this.findMatches(text, this.linktextForPath(file.path), { protect: true })) {
        here.set(m.canonical, (here.get(m.canonical) || 0) + 1);
      }
    } catch (e) { /* unreadable file: links below may still apply */ }
    if (includeLinks) {
      const cache = this.app.metadataCache.getFileCache(file);
      for (const link of (cache && cache.links) || []) {
        const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
        if (dest && this.isGlossaryFile(dest)) here.set(dest.basename, (here.get(dest.basename) || 0) + 1);
      }
    }
    return here;
  },

  // The notes a report scans: the whole vault, or just the linker's scope.
  reportFiles(opts) {
    return opts.wholeVault ? this.app.vault.getMarkdownFiles() : this.getScopeFiles();
  },

  // For every term, how many times it is used across in-scope notes and in which
  // files. Counts plain-text mentions; with opts.includeLinks, also direct
  // [[Term]] / [[Term|alias]] links. Terms with count 0 are orphans.
  async getUsageReport(opts = {}) {
    const counts = new Map();
    for (const [canonical, group] of this.termGroups()) {
      counts.set(canonical, { canonical, linktext: group[0].linktext, path: group[0].path, paths: group.map((x) => x.path), count: 0, files: [] });
    }
    const files = this.reportFiles(opts);
    if (!this.usageCache) this.usageCache = createUsageCache();
    const signature = `${this.indexVersion || 0}|${opts.includeLinks ? 'L' : ''}`;
    const results = await this.usageCache.run(files, signature, (file) => this.usageInFile(file, !!opts.includeLinks));
    foldUsageInto(counts, results);
    return [...counts.values()];
  },

  // A word already answered for — a term's own form, or one the exclusion list silences — so
  // it is not offered as a candidate.
  isTermWord(keys, raw) {
    return keys.some((k) => this.index.byKey.has(k)) || this.wordSilenced(raw);
  },

  // Frequent in-scope words that are not yet terms — candidates worth defining.
  // Pure frequency: a word is kept when its lemma appears in at least
  // candidateMinNotes notes. Inflected forms collapse onto one lemma.
  async collectCandidates(opts = {}) {
    const minLen = Math.max(1, this.settings.minTermLength || 1);
    const minNotes = Math.max(1, this.settings.candidateMinNotes || 1);
    const files = this.reportFiles(opts);
    if (!this.candidateCache) this.candidateCache = createUsageCache();
    // minLen changes what a note contributes, so it joins the index version in the key.
    const signature = `${this.indexVersion || 0}|${minLen}`;
    const notice = new Notice(t('notice.scanning'), 0);
    let results;
    try {
      results = await this.candidateCache.run(
        files, signature,
        (file) => scanCandidateWords(this, file, minLen, (keys, raw) => this.isTermWord(keys, raw)),
        (i, total) => { if (i % 25 === 0) notice.setMessage(t('notice.scanningProgress', { current: i + 1, total })); },
      );
    } finally {
      notice.hide();
    }
    return aggregateCandidates(results, minNotes);
  },
};
