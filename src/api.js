'use strict';

const { Notice } = require('obsidian');
const { t } = require('./shared/i18n');
const { LINKER_API } = require('./shared/discover');

// Public API exposed as `app.plugins.plugins['glossary-linker'].api`, so other
// plugins and DataviewJS can read the glossary index. Mixed into the plugin
// prototype; methods run with the plugin as `this`.
module.exports = {
  buildApi() {
    const plugin = this;
    return {
      version: this.manifest.version,

      // Every indexed term: { canonical, path, aliases }.
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

      // What the sibling linker plugins read: who we are, how we rank when two of us match
      // the same word, and which spans of a text we claim. See shared/discover.js.
      linker: {
        apiVersion: LINKER_API,
        id: 'glossary-linker',
        displayName: 'Glossary Linker',
        // Which half of the family we are. Prose linkers contest bare words with each other
        // and never with the sigil pair, so this is what keeps the precedence setting from
        // offering a choice between two plugins that can't collide.
        kind: 'prose',
        // Higher wins a contested word. A glossary term points at a whole note, a broader
        // answer than a heading anchor, so it yields to Heading Linker by default —
        // adjustable, and read from here by the other side rather than assumed. A getter,
        // so a change in settings is seen without rebuilding the api object.
        get precedence() { return plugin.settings.linkPrecedence; },
        // Spans of `text` we claim, with what each one resolves to. Protected ranges are
        // skipped, so the answer matches what we would actually decorate. The label and
        // target let whoever owns the span offer ours as a choice instead of dropping it.
        matches: (text) => plugin.findMatches(String(text || ''), null, { protect: true })
          .map((m) => ({ start: m.start, end: m.end, label: m.canonical, target: m.canonical })),
        // Open one of our targets. Ours to resolve — nobody else should have to know how a
        // glossary term maps to a note.
        open: (target, sourcePath, newTab) => plugin.openTerm(target, sourcePath, newTab),
        // Redraw after the other side changes who ranks higher, so the setting takes effect
        // in both plugins at once instead of at the next rebuild.
        refresh: () => plugin.rerenderViews(),
      },
    };
  },

  getTerms() {
    return (this.terms || []).map((t) => ({ canonical: t.canonical, path: t.path, aliases: t.aliases.slice() }));
  },

  resolveTerm(name) {
    if (!name) return null;
    const q = String(name).toLowerCase();
    for (const t of this.terms || []) {
      if (t.canonical.toLowerCase() === q) return { canonical: t.canonical, path: t.path, aliases: t.aliases.slice() };
      if (t.aliases.some((a) => a.toLowerCase() === q)) return { canonical: t.canonical, path: t.path, aliases: t.aliases.slice() };
    }
    return null;
  },

  // For every term, how many times it is used across in-scope notes and in which
  // files. Counts plain-text mentions; with opts.includeLinks, also direct
  // [[Term]] / [[Term|alias]] links. Terms with count 0 are orphans.
  async getUsageReport(opts = {}) {
    const counts = new Map();
    for (const t of this.terms || []) counts.set(t.canonical, { canonical: t.canonical, path: t.path, count: 0, files: [] });
    const files = opts.wholeVault ? this.app.vault.getMarkdownFiles() : this.getScopeFiles();
    for (const file of files) {
      const here = new Map();
      try {
        const text = await this.app.vault.cachedRead(file);
        for (const m of this.findMatches(text, this.canonicalForPath(file.path), { protect: true })) {
          here.set(m.canonical, (here.get(m.canonical) || 0) + 1);
        }
      } catch (e) { /* unreadable file: links below may still apply */ }
      if (opts.includeLinks) {
        const cache = this.app.metadataCache.getFileCache(file);
        for (const link of (cache && cache.links) || []) {
          const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
          if (dest && this.isGlossaryFile(dest)) here.set(dest.basename, (here.get(dest.basename) || 0) + 1);
        }
      }
      for (const [canonical, n] of here) {
        const entry = counts.get(canonical);
        if (!entry) continue;
        entry.count += n;
        entry.files.push({ path: file.path, count: n });
      }
    }
    return [...counts.values()];
  },

  // Frequent in-scope words that are not yet terms — candidates worth defining.
  // Pure frequency: a word is kept when its lemma appears in at least
  // candidateMinNotes notes. Inflected forms collapse onto one lemma.
  async collectCandidates(opts = {}) {
    const minLen = Math.max(1, this.settings.minTermLength || 1);
    const minNotes = Math.max(1, this.settings.candidateMinNotes || 1);
    const groups = new Map(); // lemma -> { forms: Map<surface, count>, total, files: Set }
    const files = opts.wholeVault ? this.app.vault.getMarkdownFiles() : this.getScopeFiles();
    const notice = new Notice(t('notice.scanning'), 0);
    try {
      for (let i = 0; i < files.length; i++) {
        if (i % 25 === 0) notice.setMessage(t('notice.scanningProgress', { current: i + 1, total: files.length }));
        let text;
        try { text = await this.app.vault.cachedRead(files[i]); } catch (e) { continue; }
        const protect = this.computeProtected(text);
        for (const m of text.matchAll(/[\p{L}\p{Nd}]+/gu)) {
          const raw = m[0];
          if (/^\p{Nd}+$/u.test(raw)) continue;
          if (this.overlapsProtected(protect, m.index, m.index + raw.length)) continue;
          if (this.keysFor(raw).some((k) => this.index.byKey.has(k) || this.excludeWordKeys.has(k))) continue;
          const lemma = this.lemmaFor(raw);
          if (lemma.length < minLen) continue;
          let g = groups.get(lemma);
          if (!g) { g = { forms: new Map(), total: 0, files: new Set() }; groups.set(lemma, g); }
          g.forms.set(raw, (g.forms.get(raw) || 0) + 1);
          g.total++;
          g.files.add(files[i].path);
        }
      }
    } finally {
      notice.hide();
    }

    const out = [];
    for (const [lemma, g] of groups) {
      if (g.files.size < minNotes) continue;
      // Show the most common surface form rather than the (sometimes odd) stem.
      let display = lemma, best = -1;
      for (const [form, n] of g.forms) if (n > best) { best = n; display = form; }
      out.push({ lemma, display, count: g.total, docFreq: g.files.size });
    }
    out.sort((a, b) => b.docFreq - a.docFreq || b.count - a.count);
    return out.slice(0, 100);
  },

  onIndexChange(cb) {
    if (typeof cb !== 'function') return () => {};
    if (!this._indexListeners) this._indexListeners = new Set();
    this._indexListeners.add(cb);
    return () => this._indexListeners.delete(cb);
  },

  notifyIndexChange() {
    for (const cb of this._indexListeners || []) {
      try { cb(); } catch (e) { /* subscriber threw */ }
    }
  },
};
