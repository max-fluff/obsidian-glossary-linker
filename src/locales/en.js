'use strict';

// English — the source of truth. Every other locale falls back to these keys.
// Plurals: simple "N noun" phrases use plural.<noun>; the few messages with a
// literal "(s)"/"(es)" keep that literal in both categories (matching the
// pre-i18n output) while other locales decline properly.

module.exports = {
  // Commands
  'cmd.openOverview': 'Open glossary overview',
  'cmd.linkThisNote': 'Link glossary terms: this note',
  'cmd.linkSelection': 'Link glossary terms: selection',
  'cmd.linkAllNotes': 'Link glossary terms: all notes',
  'cmd.unlinkThisNote': 'Unlink glossary terms: this note',
  'cmd.unlinkSelection': 'Unlink glossary terms: selection',
  'cmd.unlinkAllNotes': 'Unlink glossary terms: all notes',
  'cmd.collectThisNote': 'Collect aliases from links: this note',
  'cmd.collectAllNotes': 'Collect aliases from links: all notes',
  'cmd.createTerm': 'Create glossary term from selection',
  'cmd.rebuildIndex': 'Rebuild glossary index',
  'cmd.addAlias': 'Add alias to glossary term',

  'ribbon.tooltip': 'Glossary overview',
  'statusBar.aria': '{n} glossary term(s) on this page — click to link them',

  // Native context-menu items (brand prefix "Glossary:" kept verbatim)
  'menu.createTermLink': 'Glossary: create term & link',
  'menu.createTerm': 'Glossary: create term',
  'menu.addAlias': 'Glossary: make this an alias for…',
  // No plugin name on these: they act on the link under the cursor, and a link belongs to
  // exactly one linker, so there is never a second one of them to tell apart. The name goes
  // on configuration items instead, where the reader is picking which plugin to change.
  'menu.unlinkThisTerm': 'Unlink this term',
  'menu.collectThisAlias': 'Collect this alias',
  // Says whose aliases: the heading linker offers its own version on the same note menu,
  // and the two write to different places.
  'menu.collectFromNote': 'Collect glossary aliases from links',
  'menu.removeFromAlwaysExcluded': 'Glossary: remove from always-excluded',
  'menu.addToAlwaysExcluded': 'Glossary: add {noun} to always-excluded',
  'menu.removeFromScope': 'Glossary: remove {noun} from scope',
  'menu.includeInScope': 'Glossary: include {noun} in scope',

  // Linking a word from Obsidian's own editor menu. The three ways to link differ only in
  // how far they reach, so they share one entry with the choice inside it. Each reads on its
  // own — a submenu item is read without its parent in view, so "Here" alone would not say
  // what it does.
  'menu.linkScopeThisNote': 'Link {scope} "{display}" to term: this note',
  'menu.linkScopeAllNotes': 'Link {scope} "{display}" to term: all notes',
  'menu.openTitle': 'Open…',
  'menu.openNewTabTitle': 'Open in new tab…',

  // Exclusion menu items
  'exclude.words': 'excluded words',
  'exclude.terms': 'excluded terms',
  'exclude.add': 'Add "{value}" to {noun}',
  'exclude.remove': 'Remove "{value}" from {noun}',

  // Notices
  'notice.indexRebuilt': 'Glossary Linker: index rebuilt',
  'notice.unlinked': 'Glossary Linker: unlinked',
  'notice.noMatches': 'Glossary Linker: no matches found',
  'notice.noGlossaryLinks': 'Glossary Linker: no glossary links found',
  'notice.noteChanged': 'Glossary Linker: note changed since preview, nothing written',
  'notice.scopeWritten': 'Glossary Linker: {files}, {links}',
  'notice.linksCreated': 'Glossary Linker: {links} created',
  'notice.linksRemoved': 'Glossary Linker: {links} removed',
  'notice.linkCreatedSingle': 'Glossary Linker: link created',
  'notice.occurrenceNotFound': 'Glossary Linker: occurrence not found',
  'notice.noOccurrences': 'Glossary Linker: no occurrences found',
  'notice.scanning': 'Glossary Linker: scanning…',
  'notice.scanningProgress': 'Glossary Linker: scanning {current}/{total}…',
  'notice.nothingSelected': 'Glossary Linker: nothing selected',
  'notice.alreadyMatchesOpened': 'Glossary Linker: "{sel}" already matches "{term}" — opened it',
  'notice.invalidTermName': 'Glossary Linker: selection is not a valid term name',
  'notice.termExists': 'Glossary Linker: term "{name}" already exists',
  'notice.couldNotCreate': 'Glossary Linker: could not create term note',
  'notice.templateNotFound': 'Glossary Linker: template not found: {path}',
  'notice.couldNotReadTemplate': 'Glossary Linker: could not read template',
  'notice.alreadyExcluded': 'Glossary Linker: "{value}" is already excluded',
  'notice.addedToExcluded': 'Glossary Linker: added "{value}" to {where}',
  'notice.wasNotExcluded': 'Glossary Linker: "{value}" was not excluded',
  'notice.removedFromExcluded': 'Glossary Linker: removed "{value}" from {where}',
  'notice.aliasesAdded': 'Glossary Linker: {aliases} added',
  'notice.noNewAliases': 'Glossary Linker: no new aliases found',
  'notice.wordingMatchesTerm': 'Glossary Linker: that wording already matches the term',
  'notice.noNewAlias': 'Glossary Linker: no new alias to collect',
  'notice.pathAddedExcluded': 'Glossary Linker: added "{entry}" to always-excluded paths',
  'notice.pathRemovedExcluded': 'Glossary Linker: removed "{entry}" from always-excluded paths',
  'notice.pathAddedScope': 'Glossary Linker: added "{entry}" to paths in scope',
  'notice.pathRemovedScope': 'Glossary Linker: removed "{entry}" from paths in scope',

  // Settings — headings
  'set.heading.collecting': 'Collecting aliases',
  'set.heading.overview': 'Overview',

  // Settings — entries
  'set.glossaryFolder.name': 'Glossary folder',
  'set.glossaryFolder.desc': 'Folder with one note per term (file name = the term title). Leave empty to use the whole vault as the glossary.',
  'set.termTemplate.name': 'Term template',
  'set.termTemplate.desc': 'Note used as the body of new term notes; placeholders like {{title}} and {{date}} are filled in. Empty = blank note.',
  'set.scopeMode.desc': 'Which notes terms are highlighted and linked in.',
  'set.scopeFolders.name': 'Paths to include',
  'set.scopeFolders.desc': 'A file or a folder. Only these are linked.',
  'set.excludeFolders.name': 'Always excluded',
  'set.excludeFolders.desc': 'A file or a folder. Never linked, whatever the mode above says.',
  'set.folderList.remove': 'Remove',
  'set.matchMode.desc': 'How an inflected word is matched to a term.',
  'set.minTermLength.name': 'Minimum term length',
  'set.minTermLength.desc': 'Ignore term titles and aliases shorter than this many characters, so single letters do not match everywhere.',
  'set.languages.invalidSuffix': ', {n} invalid',
  'set.linkFirstOnly.desc': 'When turning terms into links, link only the first occurrence of each term on a page.',
  'set.excludeTerms.name': 'Excluded terms',
  'set.excludeTerms.desc': 'Term titles or aliases, one per line — drops the whole matching entry from the index.',
  'set.excludeWords.name': 'Excluded words',
  'set.excludeWords.desc': 'Surface words, one per line, that never trigger a link even if they match a term.',
  'set.highlightInReading.desc': 'Underline detected terms as clickable links in Reading view (file unchanged).',
  'set.editingHighlight.desc': 'Underline terms in the editor (Live Preview / Source) too.',
  'set.editingHighlight.off': 'Off',
  'set.skipHeadings.desc': 'Do not highlight or link terms that appear inside Markdown headings.',
  'set.statusBar.desc': 'Show how many glossary terms are on the current note in the status bar.',
  'set.statusBarIncludeLinks.desc': 'Also count terms already linked directly, not only plain-text mentions.',
  'set.linkSuggest.desc': 'As you type in an in-scope note, offer to insert a [[link]] to a matching glossary term (prefix of a title/alias, or an inflected form).',
  'set.suggestSkipAfter.desc': 'Don\'t suggest when the word follows one of these characters, so other autocompletes keep their slot. Empty disables it.',
  'set.aliasHarvestMode.name': 'Alias form',
  'set.aliasHarvestMode.desc': 'How collected link text is stored as an alias.',
  'set.aliasHarvestMode.lemma': 'Base form',
  'set.aliasHarvestMode.literal': 'As written',
  'set.aliasHarvestMode.both': 'Both',
  'set.harvestOnSave.name': 'Collect on save',
  'set.harvestOnSave.desc': 'Collect aliases automatically when a note is saved.',
  'set.harvestOnSave.off': 'Off',
  'set.harvestOnSave.silent': 'Silent (add automatically)',
  'set.harvestOnSave.preview': 'Ask first',
  'set.harvestSingleWordOnly.name': 'Single-word aliases only',
  'set.harvestSingleWordOnly.desc': 'Only collect link texts that are a single word.',
  'set.harvestMinLength.name': 'Minimum alias length',
  'set.harvestMinLength.desc': 'Ignore collected aliases shorter than this many characters.',
  'set.aliasCollisionWarnings.name': 'Warn about alias collisions',
  'set.aliasCollisionWarnings.desc': 'When collecting an alias or creating a term, flag wording that already matches a different term (so you can avoid making a word point at two terms).',
  'set.menuTurnInto.name': '"Link to term" items',
  'set.menuTurnInto.desc': 'Show the "Link to term" / "Link all … to term" actions when right-clicking a highlighted term.',
  'set.menuCollect.name': '"Collect aliases" items',
  'set.menuCollect.desc': 'Offer to collect a link’s own wording as an alias — on the link itself, and for a whole note from its right-click menu.',
  'set.menuExclude.name': '"Exclude word / term" items',
  'set.menuExclude.desc': 'Show "Add … to excluded words / terms" when right-clicking a term, and "Add … to excluded words" on a selected word.',
  'set.menuOpen.name': '"Open glossary note" items',
  'set.menuOpen.desc': 'Show "Open glossary note" / "Open in new tab" when right-clicking a highlighted term.',
  'set.menuCreateTerm.name': '"Create term from selection" items',
  'set.menuCreateTerm.desc': 'Show the "Glossary: create term…" actions when right-clicking a plain text selection.',
  'set.menuAddAlias.name': '"Make this an alias" item',
  'set.menuAddAlias.desc': 'Show a context-menu item on a plain text selection that attaches it as an alias to a term you pick.',
  'set.menuUnlink.name': '"Unlink term" item',
  'set.menuUnlink.desc': 'Show "Glossary: unlink this term" when right-clicking an existing glossary link.',
  'set.showRibbonIcon.name': 'Ribbon icon',
  'set.showRibbonIcon.desc': 'Show a ribbon button that opens the glossary overview panel. The "Open glossary overview" command works either way.',
  'set.rebuild.name': 'Rebuild glossary index',
  'set.rebuild.desc': 'Re-scan the glossary folder now.',
  'set.collecting.desc': "Reads the links you already made by hand, like [[Term|some wording]], and adds that wording to the term's aliases — so the same wording links automatically next time.",
  'set.folderNotFound': '⚠ Folder not found — no terms will be indexed.',
  'set.termsIndexed': '{terms} indexed.',
  'set.wholeVaultStatus': 'Whole vault is the glossary — {terms} indexed.',

  // Modals
  'modal.materialize.title': 'Link glossary terms — preview',
  'modal.materialize.ambiguous': '{n} ambiguous word(s) match more than one term — pick one (applies to every occurrence):',
  'modal.harvest.title': 'Collect aliases — preview',
  'modal.harvest.summary': 'Terms: {terms}, new aliases: {aliases}',
  'modal.harvest.alsoMatches': 'Also matches: {terms}',
  'modal.harvest.alreadyPresent': 'Already present (skipped): {items}',
  'modal.unlink.title': 'Unlink glossary terms — preview',
  'modal.alias.pickTerm': 'Which term is this an alias for?',
  'modal.alias.title': 'Alias for "{term}"',
  'modal.alias.body': 'A form the stemmer cannot derive from the title: an abbreviation (CNS, PNS), a synonym, or an alternate spelling. Matched verbatim, so type it exactly as it appears.',
  'notice.noTerms': 'No glossary terms in the vault yet.',
  'notice.aliasExists': '"{alias}" is already linked to "{term}".',
  'notice.aliasAdded': 'Added alias "{alias}" → "{term}".',
  'notice.aliasAddedCollision': 'Added "{alias}" → "{term}", but it already matches: {others}.',
  'notice.termFileMissing': 'Term note for "{term}" not found — it may have been moved or deleted.',
  'btn.write': 'Write',

  // Overview panel
  'view.title': 'Glossary',
  'overview.rescan': 'Rescan',
  'overview.wholeVault': 'whole vault',
  'overview.wholeVaultAria': 'Scan every note instead of only the linker scope',
  'overview.terms': 'Terms',
  'overview.candidates': 'Candidates',
  'overview.sort': 'Sort',
  'overview.sortMostUsed': 'Most used',
  'overview.sortName': 'Name',
  'overview.countLinks': 'count links',
  'overview.countLinksAria': 'Also count existing [[Term]] links, not just plain-text mentions',
  'overview.noTerms': 'No terms indexed.',
  'overview.openAria': 'Open — middle-click for a new tab',
  'overview.unused': 'unused ⚠',
  'overview.linkAll': 'link all',
  'overview.sortNotes': 'Notes',
  'overview.sortMentions': 'Mentions',
  'overview.minNotes': 'Min notes',
  'overview.noCandidates': 'No candidates.',
  'overview.addTerm': '+ term',

  // Autocomplete suggestions
  // The line under a name in the autocomplete popup. Kept to a fragment, not a sentence:
  // it sits under the term it describes, and the heading linker's candidates share the same
  // popup, so the two have to read as one list.
  'suggest.inflection': 'word form',
  'suggest.alias': 'as “{form}”',

  // Highlight tooltip

  // Plural noun phrases
  'plural.term': { one: '{n} term', other: '{n} terms' },
  'plural.use': { one: '{n} use', other: '{n} uses' },
  'plural.note': { one: '{n} note', other: '{n} notes' },
  'plural.link': { one: '{n} link(s)', other: '{n} link(s)' },
  'plural.file': { one: '{n} file(s)', other: '{n} file(s)' },
};
