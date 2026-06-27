'use strict';

const obsidian = require('obsidian');
const { EditorSuggest } = obsidian;

// Inline autocomplete: while typing in an in-scope note, offer to insert a
// [[link]] to a glossary term. Two kinds of candidate:
//   - 'form'   — the typed word is an inflection of a term (same engine as the
//                highlighter); inserts [[Term|typed word]], preserving wording.
//   - 'prefix' — the typed text is a prefix of a term title/alias; completes to
//                [[Term]].
// EditorSuggest and Plugin.registerEditorSuggest predate the plugin's
// minAppVersion, but callers still feature-detect via suggestAvailable().
class GlossaryTermSuggest extends EditorSuggest {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onTrigger(cursor, editor, file) {
    const plugin = this.plugin;
    if (!plugin.settings.linkSuggest) return null;
    if (!file || !plugin.inScope(file.path) || plugin.isGlossaryFile(file)) return null;

    const line = editor.getLine(cursor.line);
    // Only complete at the end of a word — not while the cursor sits inside one.
    if (/[\p{L}\p{Nd}]/u.test(line[cursor.ch] || '')) return null;
    const m = line.slice(0, cursor.ch).match(/[\p{L}\p{Nd}]+$/u);
    if (!m) return null;
    const query = m[0];
    if (query.length < Math.max(1, plugin.settings.suggestMinChars || 1)) return null;

    // Skip code/links/frontmatter/urls/headings — same ranges the linker protects.
    const off = editor.posToOffset(cursor);
    if (plugin.overlapsProtected(plugin.computeProtected(editor.getValue()), off, off)) return null;

    return { start: { line: cursor.line, ch: cursor.ch - query.length }, end: cursor, query };
  }

  getSuggestions(context) {
    const plugin = this.plugin;
    const q = context.query;
    const qLower = q.toLowerCase();
    const byCanonical = new Map();

    // 'form' matches: typed word is an inflection of a term's first word.
    const seenCand = new Set();
    for (const key of plugin.keysFor(q)) {
      const bucket = plugin.index.byKey.get(key);
      if (!bucket) continue;
      for (const c of bucket) {
        if (c.wordCount !== 1 || seenCand.has(c)) continue;
        seenCand.add(c);
        if (!byCanonical.has(c.canonical)) byCanonical.set(c.canonical, { canonical: c.canonical, matchedForm: c.canonical, kind: 'form' });
      }
    }

    // 'prefix' matches: typed text starts a term title or alias.
    for (const t of plugin.terms || []) {
      if (byCanonical.has(t.canonical)) continue;
      let form = null;
      if (t.canonical.toLowerCase().startsWith(qLower)) form = t.canonical;
      else { const a = t.aliases.find((al) => al.toLowerCase().startsWith(qLower)); if (a) form = a; }
      if (form) byCanonical.set(t.canonical, { canonical: t.canonical, matchedForm: form, kind: 'prefix' });
    }

    const items = [...byCanonical.values()];
    const rank = (it) => (it.kind === 'form' ? 0 : 1);
    items.sort((a, b) => rank(a) - rank(b) || a.matchedForm.length - b.matchedForm.length || a.canonical.localeCompare(b.canonical));
    return items.slice(0, 8);
  }

  renderSuggestion(item, el) {
    el.addClass('glossary-suggestion');
    el.createSpan({ cls: 'glossary-suggestion-title', text: item.canonical });
    let note = '';
    if (item.kind === 'form') note = 'inflection';
    else if (item.matchedForm !== item.canonical) note = `alias: ${item.matchedForm}`;
    if (note) el.createSpan({ cls: 'glossary-suggestion-note', text: note });
  }

  selectSuggestion(item) {
    const ctx = this.context;
    if (!ctx) return;
    const editor = ctx.editor;
    // 'form' keeps the typed wording as the visible text; 'prefix' completes to the title.
    const display = item.kind === 'form' ? ctx.query : item.canonical;
    const inTable = this.plugin.inTableCell(editor.getValue(), editor.posToOffset(ctx.start));
    const link = this.plugin.wikiLink(item.canonical, display, inTable);
    editor.replaceRange(link, ctx.start, ctx.end);
    editor.setCursor(editor.offsetToPos(editor.posToOffset(ctx.start) + link.length));
  }
}

const suggestAvailable = () => typeof EditorSuggest === 'function';

module.exports = { GlossaryTermSuggest, suggestAvailable };
