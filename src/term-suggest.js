'use strict';

const { t } = require('./shared/i18n');
const { createProseSuggest, suggestAvailable } = require('./shared/prose/editor-suggest');
const { suggestionsAllowed } = require('./shared/prose/suggest');

// The candidates for a typed word, ranked, or an empty list. Kept out of the class and free
// of editor state: onTrigger needs the answer before it can decide whether to claim the
// popup, and it is the piece worth testing on its own.
function collectSuggestions(plugin, query, ownCanonical) {
  const qLower = query.toLowerCase();
  const byCanonical = new Map();

  // 'form' matches: typed word is an inflection of a term's first word.
  const seenCand = new Set();
  for (const key of plugin.keysFor(query)) {
    const bucket = plugin.index.byKey.get(key);
    if (!bucket) continue;
    for (const c of bucket) {
      if (c.wordCount !== 1 || seenCand.has(c) || c.canonical === ownCanonical) continue;
      seenCand.add(c);
      if (!byCanonical.has(c.canonical)) byCanonical.set(c.canonical, { canonical: c.canonical, matchedForm: c.canonical, kind: 'form' });
    }
  }

  // 'prefix' matches: typed text starts a term title or alias.
  for (const t of plugin.terms || []) {
    if (byCanonical.has(t.canonical) || t.canonical === ownCanonical) continue;
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

// The line under a candidate's name in the popup. Shared by our own rendering and by the
// shape we hand a sibling linker, so a term reads the same whoever's popup it lands in.
function noteFor(item) {
  if (item.kind === 'form') return t('suggest.inflection');
  if (item.matchedForm !== item.canonical) return t('suggest.alias', { form: item.matchedForm });
  return '';
}

// Our candidates in the shape a sibling linker consumes: no internals, and `display` says
// what the inserted link should read — null meaning "keep whatever the reader typed", which
// is what a 'form' match is for.
function suggestionsFor(plugin, query, sourcePath) {
  if (!suggestionsAllowed(plugin, query, sourcePath)) return [];
  return collectSuggestions(plugin, query, plugin.activeCanonical()).map((it) => ({
    label: it.canonical,
    note: noteFor(it),
    target: it.canonical,
    display: it.kind === 'form' ? null : it.canonical,
  }));
}

const GlossaryTermSuggest = createProseSuggest({
  cls: 'glossary',
  // A term's own note does not offer that term. In folder mode inScope already rules the
  // note out; in whole-vault mode every note is a term source, so the candidate set is what
  // has to drop it — the same exclusion the highlighter makes.
  ownId: (plugin) => plugin.activeCanonical(),
  collect: collectSuggestions,
  noteFor,
  labelOf: (it) => it.canonical,
  targetOf: (it) => it.canonical,
  // 'form' keeps the typed wording; 'prefix' completes to the term title.
  displayFor: (it, query) => (it.kind === 'form' ? query : it.canonical),
});

module.exports = { GlossaryTermSuggest, suggestAvailable, collectSuggestions, suggestionsFor };
