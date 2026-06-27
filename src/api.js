'use strict';

// Public API exposed as `app.plugins.plugins['glossary-linker'].api`, so other
// plugins and DataviewJS can read the glossary index. Mixed into the plugin
// prototype; methods run with the plugin as `this`.
module.exports = {
  buildApi() {
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

      // Subscribe to index rebuilds; returns an unsubscribe function.
      onChange: (cb) => this.onIndexChange(cb),
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

  // For every term, the number of plain-text occurrences across in-scope notes
  // and which files they appear in. Terms with count 0 are orphans.
  async getUsageReport() {
    const counts = new Map();
    for (const t of this.terms || []) counts.set(t.canonical, { canonical: t.canonical, path: t.path, count: 0, files: [] });
    const files = this.getScopeFiles();
    for (const file of files) {
      let text;
      try { text = await this.app.vault.cachedRead(file); } catch (e) { continue; }
      const here = new Map();
      for (const m of this.findMatches(text, this.canonicalForPath(file.path), { protect: true })) {
        here.set(m.canonical, (here.get(m.canonical) || 0) + 1);
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

  onIndexChange(cb) {
    if (typeof cb !== 'function') return () => {};
    if (!this._indexListeners) this._indexListeners = new Set();
    this._indexListeners.add(cb);
    return () => this._indexListeners.delete(cb);
  },
};
