'use strict';

const { t } = require('./shared/i18n');
const { ownedMatches, yieldedCandidates, candidatesFor, discoverLinkers } = require('./shared/discover');

// Highlighting in Reading view (DOM) and in the editor (CM6). Mixed into the plugin prototype.
module.exports = {
  // Our matches minus the ones a higher-ranked sibling linker also claims. With no sibling
  // installed this is the list itself and costs nothing; with one, a word both know is
  // drawn once, by the same plugin in both render modes, rather than by whichever ran
  // first. See shared/discover.js.
  ownSpans(text, matches) {
    const provider = this.api && this.api.linker;
    if (!provider) return matches;
    return ownedMatches(this.app, provider, text, matches);
  },

  // What the linkers that yielded a span to us would have offered there. Empty in a solo
  // vault, so the caller pays nothing for asking.
  yieldedIn(text) {
    const provider = this.api && this.api.linker;
    if (!provider) return [];
    return yieldedCandidates(this.app, provider, text);
  },

  processReadingMode(el, ctx) {
    if (!this.settings.highlightInReading) return;
    const sourcePath = ctx.sourcePath;
    if (sourcePath && !this.inScope(sourcePath)) return;
    const currentCanonical = this.canonicalForPath(sourcePath);

    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        let p = node.parentElement;
        while (p) {
          const tag = p.tagName;
          if (tag === 'CODE' || tag === 'PRE' || tag === 'A') return NodeFilter.FILTER_REJECT;
          if (this.settings.skipHeadings && /^H[1-6]$/.test(tag)) return NodeFilter.FILTER_REJECT;
          if (p.classList && p.classList.contains('glossary-link')) return NodeFilter.FILTER_REJECT;
          if (p === el) break;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) this.decorateTextNode(node, currentCanonical, sourcePath);
  },

  decorateTextNode(node, currentCanonical, sourcePath) {
    const text = node.textContent;
    if (!text || text.length < 2) return;
    // protect:true keeps this in step with the materialize path, so the Nth
    // highlighted occurrence here is the Nth occurrence that gets linked.
    const matches = this.ownSpans(text, this.findMatches(text, currentCanonical, { protect: true }));
    if (!matches.length) return;
    // Collected once for the whole node, not per match.
    const yielded = this.yieldedIn(text);

    const frag = document.createDocumentFragment();
    let cursor = 0;
    for (const m of matches) {
      if (m.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
      const canonical = m.canonical;
      const display = m.display;
      // Another linker's readings of the same word sit alongside our own alternatives: a
      // word that means two things is ambiguous whether or not one plugin knows both.
      const foreign = candidatesFor(yielded, m.start, m.end);
      const alts = [...(m.alts || []), ...foreign];
      const a = document.createElement('a');
      a.textContent = display;
      a.setAttribute('data-glossary-target', canonical); // used for occurrence counting below
      if (alts.length) {
        // Ambiguous: no data-href, so Obsidian shows no (misleading) single-page
        // preview, just the aria-label tooltip. Click asks which term to open.
        a.className = 'glossary-link glossary-ambiguous';
        const candidates = [canonical, ...alts];
        // Just the names. Which plugin answers for which is machinery, not something the
        // reader is choosing between — they are picking a meaning.
        const names = candidates.map((c) => (typeof c === 'object' ? c.label : c));
        a.setAttribute('aria-label', t('highlight.matches', { terms: names.join(', ') }));
        const pick = (e, newTab) => {
          e.preventDefault();
          e.stopPropagation();
          // The modal opens a foreign candidate with no arguments, so where and how to open
          // is bound here, at the click that knows both.
          this.chooseTerm(
            candidates.map((c) => (typeof c === 'object' ? { ...c, open: () => c.open(sourcePath, newTab) } : c)),
            newTab ? t('menu.openNewTabTitle') : t('menu.openTitle'),
            (c) => this.openTerm(c, sourcePath, newTab)
          );
        };
        a.addEventListener('click', (e) => pick(e, e.ctrlKey || e.metaKey));
        // Middle-click fires auxclick; suppress the default new-tab nav so it routes
        // through the picker too.
        a.addEventListener('auxclick', (e) => { if (e.button === 1) pick(e, true); });
        a.addEventListener('mousedown', (e) => { if (e.button === 1) { e.preventDefault(); e.stopPropagation(); } });
      } else {
        // Single term: a real internal link, so hover shows its page preview.
        a.className = 'internal-link glossary-link';
        a.href = canonical;
        a.setAttribute('data-href', canonical);
      }
      // No context menu here on purpose. Reading view is for reading: a click opens (asking
      // which target when there are several), and everything that edits the note lives in
      // the editor's own menu. Offering "link this word" here but not its opposite was the
      // asymmetry that made the two menus feel like different plugins.
      frag.appendChild(a);
      cursor = m.end;
    }
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(frag, node);
  },

  // Editor highlight (Live Preview / Source). Always registered; the
  // editingHighlight setting controls if and how often it recomputes.
  registerEditingHighlight() {
    let view, state, language;
    try {
      view = require('@codemirror/view');
      state = require('@codemirror/state');
      language = require('@codemirror/language');
    } catch (e) {
      console.warn('Glossary Linker: CM6 modules unavailable, editor highlight disabled', e);
      return;
    }
    const { ViewPlugin, Decoration } = view;
    const { RangeSetBuilder, StateEffect } = state;
    const { syntaxTree } = language;
    const plugin = this;

    const refresh = StateEffect.define();
    this.cmRefreshEffect = refresh;

    const markCache = new Map();
    const markFor = (canonical) => {
      let m = markCache.get(canonical);
      if (!m) {
        m = Decoration.mark({ class: 'cm-glossary-link', attributes: { 'data-glossary-target': canonical } });
        markCache.set(canonical, m);
      }
      return m;
    };
    // Collision marks carry a per-match tooltip + alt list, so they are not cached.
    // The tooltip lists every matching term, including the one it resolves to.
    // Another linker's readings ride along as data: a decoration is attributes, not closures,
    // so the candidate keeps the peer's id and the opener is looked up again on click.
    const markWithAlts = (canonical, alts, foreign) => {
      const names = [canonical, ...alts, ...foreign.map((f) => f.label)];
      const attributes = {
        'data-glossary-target': canonical,
        'data-glossary-alts': alts.join('\n'),
        'aria-label': t('highlight.matches', { terms: names.join(', ') }),
      };
      if (foreign.length) {
        attributes['data-glossary-foreign'] = JSON.stringify(foreign.map((f) => ({ id: f.id, label: f.label, target: f.target, source: f.source })));
      }
      return Decoration.mark({ class: 'cm-glossary-link cm-glossary-ambiguous', attributes });
    };

    const skipNode = (name) => /code|link|url|header|hashtag|frontmatter|comment|tag|escape/i.test(name);

    const buildDeco = (editorView) => {
      const builder = new RangeSetBuilder();
      const activeFile = plugin.app.workspace.getActiveFile();
      if (activeFile && !plugin.inScope(activeFile.path)) return builder.finish();
      const currentCanonical = plugin.activeCanonical();
      const tree = syntaxTree(editorView.state);
      for (const { from, to } of editorView.visibleRanges) {
        const text = editorView.state.doc.sliceString(from, to);
        // Once per visible range, not per match.
        const yielded = plugin.yieldedIn(text);
        for (const m of plugin.ownSpans(text, plugin.findMatches(text, currentCanonical))) {
          const start = from + m.start;
          const end = from + m.end;
          let skip = false;
          tree.iterate({ from: start, to: end, enter: (n) => { if (skipNode(n.type.name)) skip = true; } });
          if (skip) continue;
          const alts = m.alts || [];
          const foreign = candidatesFor(yielded, m.start, m.end);
          builder.add(start, end, alts.length || foreign.length ? markWithAlts(m.canonical, alts, foreign) : markFor(m.canonical));
        }
      }
      return builder.finish();
    };

    const targetEl = (e) => (e.target instanceof HTMLElement ? e.target.closest('.cm-glossary-link') : null);
    const canonicalOf = (el) => el.getAttribute('data-glossary-target');
    const altsOf = (el) => { const v = el.getAttribute('data-glossary-alts'); return v ? v.split('\n') : null; };
    // Another linker's readings, parked on the decoration as data. The opener is resolved
    // now rather than then: the plugin may have been disabled since the mark was drawn.
    const foreignOf = (el, sourcePath, newTab) => {
      const raw = el.getAttribute('data-glossary-foreign');
      if (!raw) return [];
      let parsed;
      try { parsed = JSON.parse(raw); } catch (err) { return []; }
      const peers = discoverLinkers(plugin.app);
      return parsed.map((f) => ({
        label: f.label,
        source: f.source,
        open: () => {
          const peer = peers.find((p) => p.id === f.id);
          if (peer && typeof peer.open === 'function') peer.open(f.target, sourcePath, newTab);
        },
      }));
    };

    const vp = ViewPlugin.fromClass(
      class {
        constructor(v) { this.decorations = plugin.settings.editingHighlight === 'off' ? Decoration.none : buildDeco(v); }
        update(u) {
          const mode = plugin.settings.editingHighlight;
          if (mode === 'off') { if (this.decorations.size) this.decorations = Decoration.none; return; }
          const forced = u.transactions.some((tr) => tr.effects.some((e) => e.is(refresh)));
          if (u.viewportChanged || forced || (mode === 'live' && (u.docChanged || u.selectionSet))) {
            this.decorations = buildDeco(u.view);
          } else if (u.docChanged) {
            this.decorations = this.decorations.map(u.changes);
          }
        }
      },
      {
        decorations: (v) => v.decorations,
        eventHandlers: {
          mousedown(e) {
            const el = targetEl(e);
            if (!el) return;
            const file = plugin.app.workspace.getActiveFile();
            const sourcePath = file ? file.path : '';
            const alts = altsOf(el) || [];
            // Same set of readings the reading view offers, so a word behaves the same in
            // both modes rather than losing half its meanings in the editor.
            const pick = (newTab, title) => {
              const candidates = [canonicalOf(el), ...alts, ...foreignOf(el, sourcePath, newTab)];
              plugin.chooseTerm(candidates, title, (c) => plugin.openTerm(c, sourcePath, newTab));
            };
            // Like Obsidian's links: middle-click opens a tab, Ctrl/Cmd+click follows.
            // An ambiguous term asks which one to open first.
            if (e.button === 1) {
              pick(true, t('menu.openNewTabTitle'));
              e.preventDefault();
              return;
            }
            if (e.button !== 0 || !(e.ctrlKey || e.metaKey)) return;
            pick(false, t('menu.openTitle'));
            e.preventDefault();
          },
          mouseover(e) {
            const el = targetEl(e);
            if (!el) return;
            // Ambiguous: no single page preview — the aria-label tooltip lists the terms.
            if (el.hasAttribute('data-glossary-alts') || el.hasAttribute('data-glossary-foreign')) return;
            const file = plugin.app.workspace.getActiveFile();
            plugin.hoverTerm(e, el, canonicalOf(el), file ? file.path : '');
          },
          // No handler for contextmenu: a right-click in the editor already raises Obsidian's
          // own menu, and everything we offer for the word under the cursor is added there.
          // One menu, whichever half of the toggle applies.
        },
      }
    );
    this.registerEditorExtension(vp);
  },
};
