'use strict';

const { splitLines } = require('./constants');

// Term index + matching engine. Mixed into the plugin prototype.
module.exports = {
  // Keys for a word: the union from every language that claims it (same-script
  // languages overlap); words no language claims fall back to the exact form.
  keysFor(word) {
    const cacheKey = word.toLowerCase();
    if (!this.keysCache) this.keysCache = new Map();
    const cached = this.keysCache.get(cacheKey);
    if (cached) return cached;

    const out = [];
    const seen = new Set();
    for (const lang of this.activeLanguages) {
      if (!lang.match(word)) continue;
      for (const k of lang.keys(word, this.settings.matchMode)) {
        if (!seen.has(k)) { seen.add(k); out.push(k); }
      }
    }
    if (!out.length) out.push(cacheKey);
    this.keysCache.set(cacheKey, out);
    return out;
  },

  // Base form for collected aliases: the first claiming language wins (by priority).
  lemmaFor(word) {
    for (const lang of this.activeLanguages) {
      if (lang.match(word)) return lang.lemma ? lang.lemma(word) : word.toLowerCase();
    }
    return word.toLowerCase();
  },

  tokenizeForm(form) {
    const words = [...form.matchAll(/[\p{L}\p{Nd}]+/gu)].map((m) => m[0]);
    return words.map((raw) => ({ raw, lower: raw.toLowerCase(), keys: this.keysFor(raw) }));
  },

  rebuildIndex() {
    // keysFor depends on languages + matchMode, so a rebuild must drop its cache.
    this.keysCache = new Map();
    const byKey = new Map();
    const canonicals = new Set();
    // Flat list of indexed terms, kept for the autocomplete prefix scan and the
    // public API (getTerms / resolveTerm / getUsageReport).
    const terms = [];
    const excludeTerms = new Set(splitLines(this.settings.excludeTerms).map((s) => s.toLowerCase()));
    this.excludeWordKeys = new Set();
    for (const w of splitLines(this.settings.excludeWords)) {
      for (const k of this.keysFor(w)) this.excludeWordKeys.add(k);
    }

    const files = this.app.vault.getMarkdownFiles().filter((f) => this.isGlossaryFile(f));
    for (const file of files) {
      const canonical = file.basename;
      const aliases = this.aliasesOf(file);
      // An excluded title or alias drops the whole entry (vs. excludeWords, one word).
      if ([canonical, ...aliases].some((f) => excludeTerms.has(f.toLowerCase()))) continue;

      const forms = [canonical, ...aliases].filter((x) => typeof x === 'string' && x.trim());
      const target = { canonical, path: file.path };
      canonicals.add(canonical);
      terms.push({ canonical, path: file.path, aliases });

      for (const form of forms) {
        const words = this.tokenizeForm(form);
        if (!words.length) continue;
        if (words.length === 1 && words[0].keys.some((k) => this.excludeWordKeys.has(k))) continue;

        const matcher = { canonical, target, words, wordCount: words.length };
        for (const k of words[0].keys) {
          if (!byKey.has(k)) byKey.set(k, []);
          byKey.get(k).push(matcher);
        }
      }
    }
    this.index = { byKey, termCount: canonicals.size };
    this.terms = terms;
    // Notify API subscribers (guarded: rebuildIndex also runs during onload,
    // before the listener set exists).
    if (this._indexListeners) for (const cb of this._indexListeners) { try { cb(); } catch (e) { /* subscriber threw */ } }
  },

  // Canonicals of every glossary term whose form matches `text` (single- or
  // multi-word), optionally excluding one term. Reuses the matching engine, so a
  // collision found here means the same thing it does for highlighting.
  termsMatchingText(text, except) {
    const out = new Set();
    for (const m of this.findMatches(text, null)) {
      out.add(m.canonical);
      if (m.alts) for (const a of m.alts) out.add(a);
    }
    if (except) out.delete(except);
    return [...out];
  },

  findMatches(text, currentCanonical, opts = {}) {
    const protect = opts.protect ? this.computeProtected(text) : null;
    const tokens = [...text.matchAll(/[\p{L}\p{Nd}]+/gu)]
      .map((m) => {
        const raw = m[0];
        return { raw, start: m.index, end: m.index + raw.length, keys: this.keysFor(raw) };
      });

    const results = [];
    let i = 0;
    while (i < tokens.length) {
      const tk = tokens[i];
      const cands = [];
      const seen = new Set();
      for (const k of tk.keys) {
        const bucket = this.index.byKey.get(k);
        if (!bucket) continue;
        for (const c of bucket) { if (!seen.has(c)) { seen.add(c); cands.push(c); } }
      }

      // Does candidate c fit at token i? Multi-word terms must be contiguous with
      // only spaces/hyphens between, and every word's keys must overlap.
      const fits = (c) => {
        const wc = c.wordCount;
        if (i + wc > tokens.length) return false;
        for (let k = 0; k < wc; k++) {
          const t2 = tokens[i + k];
          const w = c.words[k];
          if (k > 0) {
            const between = text.slice(tokens[i + k - 1].end, t2.start);
            if (/[^\s-]/.test(between)) return false;
          }
          const t2keys = k === 0 ? t2.keys : this.keysFor(t2.raw);
          if (!t2keys.some((kk) => w.keys.includes(kk))) return false;
        }
        return true;
      };

      let matched = null;
      let sorted = null;
      if (cands.length) {
        sorted = cands.length > 1 ? cands.slice().sort((a, b) => b.wordCount - a.wordCount) : cands;
        for (const c of sorted) {
          if (fits(c)) { matched = { c, start: tokens[i].start, end: tokens[i + c.wordCount - 1].end, wc: c.wordCount }; break; }
        }
      }

      if (matched && matched.c.canonical !== currentCanonical) {
        const oneWordExcluded = matched.wc === 1 && tk.keys.some((k) => this.excludeWordKeys.has(k));
        const inProtected = protect && this.overlapsProtected(protect, matched.start, matched.end);
        if (!oneWordExcluded && !inProtected) {
          // Other glossary entries that match the same span (alias collision).
          let alts = null;
          if (sorted.length > 1) {
            const seenCanon = new Set([matched.c.canonical]);
            for (const c of sorted) {
              if (c.wordCount !== matched.wc || seenCanon.has(c.canonical)) continue;
              if (fits(c)) { seenCanon.add(c.canonical); (alts || (alts = [])).push(c.canonical); }
            }
          }
          results.push({
            start: matched.start,
            end: matched.end,
            canonical: matched.c.canonical,
            display: text.slice(matched.start, matched.end),
            alts,
          });
          i += matched.wc;
          continue;
        }
      }
      i++;
    }
    return results;
  },

  // Ranges in raw markdown that must not be linked: frontmatter, code, links, urls, headings.
  computeProtected(text) {
    const ranges = [];
    const push = (re) => { let m; while ((m = re.exec(text)) !== null) ranges.push([m.index, m.index + m[0].length]); };

    if (/^---\r?\n/.test(text)) {
      const end = text.indexOf('\n---', 3);
      if (end !== -1) ranges.push([0, end + 4]);
    }
    push(/```[\s\S]*?```/g);
    push(/~~~[\s\S]*?~~~/g);
    push(/`[^`\n]+`/g);
    push(/\[\[[^\]]*\]\]/g);
    push(/\[[^\]]*\]\([^)]*\)/g);
    push(/(?:https?:\/\/|www\.)\S+/g);
    if (this.settings.skipHeadings) push(/^[ \t]*#{1,6}[ \t].*$/gm);

    return ranges.sort((a, b) => a[0] - b[0]);
  },

  overlapsProtected(ranges, s, e) {
    for (const [rs, re] of ranges) {
      if (rs >= e) break;
      if (re > s) return true;
    }
    return false;
  },
};
