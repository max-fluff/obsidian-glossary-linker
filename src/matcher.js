'use strict';

const { splitLines } = require('./constants');

// Mixin: term index + matching engine. Methods run with the plugin as `this`.
module.exports = {
  // Match keys for a word: the union of keys from every enabled language that
  // claims it (same-script languages overlap, e.g. en/es/de/fr on Latin).
  // Unknown scripts fall back to the lowercased exact form.
  keysFor(word) {
    const out = [];
    const seen = new Set();
    for (const lang of this.activeLanguages) {
      if (!lang.match(word)) continue;
      for (const k of lang.keys(word, this.settings.matchMode)) {
        if (!seen.has(k)) { seen.add(k); out.push(k); }
      }
    }
    if (!out.length) out.push(word.toLowerCase());
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
    const byKey = new Map();
    const excludeTerms = new Set(splitLines(this.settings.excludeTerms).map((s) => s.toLowerCase()));
    this.excludeWordKeys = new Set();
    for (const w of splitLines(this.settings.excludeWords)) {
      for (const k of this.keysFor(w)) this.excludeWordKeys.add(k);
    }

    const files = this.app.vault.getMarkdownFiles().filter((f) => this.isGlossaryFile(f));
    for (const file of files) {
      const canonical = file.basename;
      if (excludeTerms.has(canonical.toLowerCase())) continue;

      const forms = [canonical, ...this.aliasesOf(file)].filter((x) => typeof x === 'string' && x.trim());
      const target = { canonical, path: file.path };

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
    this.index = { byKey };
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

      let matched = null;
      if (cands.length) {
        const sorted = cands.length > 1 ? cands.slice().sort((a, b) => b.wordCount - a.wordCount) : cands;
        for (const c of sorted) {
          const wc = c.wordCount;
          if (i + wc > tokens.length) continue;
          let ok = true;
          for (let k = 0; k < wc; k++) {
            const t2 = tokens[i + k];
            const w = c.words[k];
            if (k > 0) {
              const between = text.slice(tokens[i + k - 1].end, t2.start);
              if (/[^\s-]/.test(between)) { ok = false; break; }
            }
            const t2keys = k === 0 ? t2.keys : this.keysFor(t2.raw);
            if (!t2keys.some((kk) => w.keys.includes(kk))) { ok = false; break; }
          }
          if (ok) { matched = { c, start: tokens[i].start, end: tokens[i + wc - 1].end, wc }; break; }
        }
      }

      if (matched && matched.c.canonical !== currentCanonical) {
        const oneWordExcluded = matched.wc === 1 && tk.keys.some((k) => this.excludeWordKeys.has(k));
        const inProtected = protect && this.overlapsProtected(protect, matched.start, matched.end);
        if (!oneWordExcluded && !inProtected) {
          results.push({
            start: matched.start,
            end: matched.end,
            canonical: matched.c.canonical,
            display: text.slice(matched.start, matched.end),
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
