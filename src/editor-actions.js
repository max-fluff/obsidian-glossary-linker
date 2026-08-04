'use strict';

const { t } = require('./shared/i18n');
const { cursorReader } = require('./shared/actions');

// Everything the editor menu offers on what the cursor sits in, declared once for both
// surfaces (shared/actions.js). The branching the handler used to do lives in `resolve`: a
// link answers first, then a selection, then a match, then a word a sibling owns, then a
// word that matches nothing because it is already excluded.

const oneWord = (text) => (text.match(/[\p{L}\p{Nd}]+/gu) || []).length === 1;

const LONG = { term: '', form: 'Form', stem: 'Stem' };
const SHORT = { term: 'exclude.shortTerm', form: 'exclude.shortForm', stem: 'exclude.shortStem' };

const oneLineSelection = (editor) => {
  const sel = editor && editor.getSelection && editor.getSelection();
  return sel && !sel.includes('\n') ? sel : null;
};

// One reading of the cursor for the whole list. A right-click on a link in a table cell
// selects the cell text, so the link answers before the selection does.
const reading = cursorReader((plugin, editor) => {
  const link = plugin.glossaryLinkAt(editor);
  if (link) return { link };
  const sel = oneLineSelection(editor);
  if (sel) return { sel };
  const hit = plugin.matchAtCursor(editor);
  if (hit) return { hit };
  const word = plugin.wordAtCursor(editor);
  return word ? { word } : { raw: plugin.rawWordAtCursor(editor) };
});

const linkAt = (plugin, editor) => (editor ? reading(plugin, editor).link || null : null);
const selectionAt = (plugin, editor) => (editor ? reading(plugin, editor).sel || null : null);
const hitAt = (plugin, editor) => (editor ? reading(plugin, editor).hit || null : null);

// What the exclusion items act on, wherever the cursor is. `settled` marks the last case:
// there only the undo half is offered, since nothing matches to be stopped.
function exclusionTarget(plugin, editor) {
  if (!editor) return null;
  const at = reading(plugin, editor);
  if (at.link) return { display: at.link.display, label: at.link.canonical };
  if (at.sel) return { display: at.sel, label: null };
  if (at.hit) return { display: at.hit.match.display, label: at.hit.match.canonical };
  if (at.word) return { display: at.word.display, label: at.word.canonical };
  return at.raw ? { display: at.raw, label: at.raw, settled: true } : null;
}

// One list entry, added or removed. The add twin is tagged with a verb so it groups with
// whatever else offers to stop the same word; an undo finishes no such phrase and stays flat.
const exclusionAction = ({ id, name, listKey, kind, add }) => ({
  id,
  name,
  surface: 'editor',
  icon: add ? (kind === 'term' ? 'trash-2' : 'ban') : 'rotate-ccw',
  verb: add ? (kind === 'term' ? 'exclude' : 'silence') : undefined,
  value: (ctx) => ctx.value,
  inMenu: (plugin) => plugin.settings.menuExclude,
  title: (ctx, grouped) => t(
    grouped ? SHORT[kind] : `exclude.${add ? 'add' : 'remove'}${LONG[kind]}`,
    { value: ctx.value, noun: t(kind === 'term' ? 'exclude.terms' : 'exclude.words') }
  ),
  resolve: (plugin, editor) => {
    const target = exclusionTarget(plugin, editor);
    if (!target || (add && target.settled)) return null;
    if (kind === 'term' && !target.label) return null;
    if (kind !== 'term' && !oneWord(target.display)) return null;

    if (kind === 'stem') {
      // The line may have been written from another form of the word, so what to undo is
      // looked up; the wording still names the word under the cursor.
      const silencing = plugin.stemLineSilencing(target.display);
      if (add === !!silencing) return null;
      return { value: target.display, line: `${silencing || plugin.keysFor(target.display)[0]}*` };
    }
    const value = kind === 'term' ? target.label : target.display;
    return plugin.isExcluded(listKey, value) === add ? null : { value, line: value };
  },
  run: (plugin, ctx) => (add
    ? plugin.addToExclusion(listKey, listKey === 'excludeWords' ? ctx.line.toLowerCase() : ctx.line)
    : plugin.removeFromExclusion(listKey, ctx.line)),
});

const EXCLUSION_ACTIONS = [
  exclusionAction({ id: 'stop-spelling', name: 'cmd.stopSpelling', listKey: 'excludeWords', kind: 'form', add: true }),
  exclusionAction({ id: 'stop-forms', name: 'cmd.stopForms', listKey: 'excludeWords', kind: 'stem', add: true }),
  exclusionAction({ id: 'exclude-term', name: 'cmd.excludeTermAtCursor', listKey: 'excludeTerms', kind: 'term', add: true }),
  exclusionAction({ id: 'resume-spelling', name: 'cmd.resumeSpelling', listKey: 'excludeWords', kind: 'form', add: false }),
  exclusionAction({ id: 'resume-forms', name: 'cmd.resumeForms', listKey: 'excludeWords', kind: 'stem', add: false }),
  exclusionAction({ id: 'include-term', name: 'cmd.includeTermAtCursor', listKey: 'excludeTerms', kind: 'term', add: false }),
];

// The three ways to link one word differ only in how far they reach, so in the menu they are
// one entry with the choice inside; in the palette each is its own command, to bind a key to.
const linkAction = ({ id, name, titleKey, icon, run }) => ({
  id,
  name,
  surface: 'editor',
  icon,
  section: (ctx) => t('menu.linkThisWord', { display: ctx.display }),
  inMenu: (plugin) => plugin.settings.menuTurnInto,
  title: (ctx) => t(titleKey, { display: ctx.display, scope: ctx.scope }),
  resolve: (plugin, editor) => {
    const hit = hitAt(plugin, editor);
    const file = plugin.app.workspace.getActiveFile();
    if (!hit || !file) return null;
    return {
      editor,
      file,
      hit,
      display: hit.match.display,
      canonical: hit.match.canonical,
      scope: plugin.settings.linkFirstOnly ? t('scope.first') : t('scope.all'),
    };
  },
  run,
});

// Only our own readings: a link is written by the linker that owns it, so a peer's meaning
// here could only open its note, never link the word.
const ownCandidates = (ctx) => [ctx.hit.match.canonical, ...(ctx.hit.match.alts || [])];

const LINK_WORD_ACTIONS = [
  linkAction({
    id: 'link-word-here', name: 'cmd.linkWordHere', titleKey: 'menu.linkHere', icon: 'link',
    run: (plugin, ctx) => plugin.chooseTerm(ownCandidates(ctx), t('menu.linkDisplayTo', { display: ctx.display }),
      (c) => plugin.materializeSingle(ctx.file, ctx.canonical, ctx.display,
        ctx.editor.posToOffset({ line: ctx.hit.line, ch: ctx.hit.match.start }), 0, c)),
  }),
  linkAction({
    id: 'link-word-note', name: 'cmd.linkWordNote', titleKey: 'menu.linkScopeThisNote', icon: 'links-coming-in',
    run: (plugin, ctx) => plugin.chooseTerm(ownCandidates(ctx), t('menu.linkScopeTo', { scope: ctx.scope, display: ctx.display }),
      (c) => plugin.materializeTerm(ctx.file, ctx.canonical, c)),
  }),
  linkAction({
    id: 'link-word-scope', name: 'cmd.linkWordScope', titleKey: 'menu.linkScopeAllNotes', icon: 'links-going-out',
    run: (plugin, ctx) => plugin.chooseTerm(ownCandidates(ctx), t('menu.linkScopeTo', { scope: ctx.scope, display: ctx.display }),
      (c) => plugin.materializeTermScope(ctx.canonical, c)),
  }),
];

const OPEN_WORD = {
  id: 'open-word',
  name: 'cmd.openWord',
  surface: 'editor',
  icon: 'file-text',
  inMenu: (plugin) => plugin.settings.menuOpen,
  title: (ctx) => t('menu.openThisWord', { display: ctx.display }),
  resolve: (plugin, editor) => {
    const hit = hitAt(plugin, editor);
    if (!hit) return null;
    const file = plugin.app.workspace.getActiveFile();
    return { hit, display: hit.match.display, sourcePath: file ? file.path : '' };
  },
  run: (plugin, ctx) => plugin.chooseTerm(plugin.cursorCandidates(ctx.hit, ctx.sourcePath, false),
    t('menu.openTitle'), (c) => plugin.openTerm(c, ctx.sourcePath, false)),
};

const UNLINK_AT_CURSOR = {
  id: 'unlink-at-cursor',
  name: 'cmd.unlinkAtCursor',
  surface: 'editor',
  icon: 'unlink',
  inMenu: (plugin) => plugin.settings.menuUnlink,
  title: () => t('menu.unlinkThisTerm'),
  resolve: (plugin, editor) => {
    const link = linkAt(plugin, editor);
    return link ? { editor, link } : null;
  },
  run: (plugin, ctx) => plugin.unlinkLinkAt(ctx.editor, ctx.link),
};

const COLLECT_ALIAS = {
  id: 'collect-alias-at-cursor',
  name: 'cmd.collectAliasAtCursor',
  surface: 'editor',
  icon: 'download',
  inMenu: (plugin) => plugin.settings.menuCollect,
  title: () => t('menu.collectThisAlias'),
  resolve: (plugin, editor) => {
    const link = linkAt(plugin, editor);
    return link && link.targetFile ? { link } : null;
  },
  run: (plugin, ctx) => plugin.harvestOneLink(ctx.link.targetFile, ctx.link.display),
};

// What a selection offers: make a term of it, or hand its wording to a term as an alias.
const selectionAction = ({ id, name, titleKey, icon, inMenu, run }) => ({
  id,
  name,
  surface: 'editor',
  icon,
  inMenu,
  title: () => t(titleKey),
  resolve: (plugin, editor) => {
    if (linkAt(plugin, editor)) return null;
    const sel = selectionAt(plugin, editor);
    return sel ? { editor, sel } : null;
  },
  run,
});

const SELECTION_ACTIONS = [
  selectionAction({
    id: 'create-term-from-selection', name: 'cmd.createTerm', titleKey: 'menu.createTermLink', icon: 'plus-circle',
    inMenu: (plugin) => plugin.settings.menuCreateTerm,
    run: (plugin, ctx) => plugin.createTermFromSelection(ctx.editor, true),
  }),
  selectionAction({
    id: 'create-term-only', name: 'cmd.createTermOnly', titleKey: 'menu.createTerm', icon: 'file-plus',
    inMenu: (plugin) => plugin.settings.menuCreateTerm,
    run: (plugin, ctx) => plugin.createTermFromSelection(ctx.editor, false),
  }),
  selectionAction({
    id: 'add-alias-from-selection', name: 'cmd.addAliasFromSelection', titleKey: 'menu.addAlias', icon: 'text-cursor-input',
    inMenu: (plugin) => plugin.settings.menuAddAlias,
    run: (plugin, ctx) => plugin.addAliasFromSelection(ctx.sel),
  }),
];

// Declaration order is menu order: what a link offers, then what a selection offers, then the
// ways to link a word, then what to open, then the exclusion lists.
const EDITOR_ACTIONS = [
  UNLINK_AT_CURSOR,
  COLLECT_ALIAS,
  ...SELECTION_ACTIONS,
  ...LINK_WORD_ACTIONS,
  OPEN_WORD,
  ...EXCLUSION_ACTIONS,
];

module.exports = { EDITOR_ACTIONS };
