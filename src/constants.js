'use strict';

const DEFAULT_SETTINGS = {
  glossaryFolder: 'glossary',
  termTemplate: '', // path to a template note; empty = create an empty note (as before)
  scopeMode: 'vault', // 'folders' | 'vault'
  scopeFolders: '',
  excludeFolders: '',
  matchMode: 'stemmer', // 'stemmer' | 'endingStrip' | 'exact'
  minTermLength: 2, // forms (title/alias) shorter than this are not indexed — keeps single letters from matching everywhere
  enabledLanguages: null, // null until first-run defaults are picked
  languageOrder: [], // ids in priority order (first = highest); overrides module defaults
  aliasHarvestMode: 'lemma', // 'lemma' | 'literal' | 'both'
  harvestOnSave: 'off', // 'off' | 'silent' | 'preview'
  harvestSingleWordOnly: true,
  harvestMinLength: 2,
  excludeTerms: '',
  excludeWords: '',
  linkFirstOnly: false,
  // Who wins a word both linkers match. Read by the other side through the api, so both
  // reach the same verdict; a whole note is broader than a heading anchor, hence lower.
  linkPrecedence: 10,
  linkSuggest: false, // offer [[link]] autocomplete while typing
  suggestMinChars: 3, // min typed length before autocomplete triggers
  suggestSkipAfter: '@#$^', // yield when the word follows one of these sigils (code-linker @@, tags, math, block refs)
  aliasCollisionWarnings: true, // warn when a collected/created alias collides with another term
  candidateMinNotes: 3, // overview: a candidate must appear in at least this many notes
  overviewSort: 'usage', // overview terms order: 'usage' | 'name'
  overviewCandidateSort: 'notes', // overview candidates order: 'notes' | 'count'
  overviewCountLinks: true, // overview usage count also counts direct [[Term]] links
  overviewWholeVault: false, // overview scans every note instead of the linker scope
  overviewTermsCollapsed: false,
  overviewCandidatesCollapsed: false,
  showRibbonIcon: true,
  highlightInReading: true,
  editingHighlight: 'live', // 'off' | 'live' | 'onSave'
  skipHeadings: true,
  statusBar: true,
  statusBarIncludeLinks: true,
  menuTurnInto: true,
  menuCollect: true,
  menuOpen: true,
  menuCreateTerm: true,
  menuAddAlias: true,
  menuExclude: true,
  menuUnlink: true,
};

// Drop blank, "." and ".." segments so a stray "../" can't escape the vault.
const sanitizeFolder = (s) => (s || '')
  .split('/')
  .map((x) => x.trim())
  .filter((x) => x && x !== '.' && x !== '..')
  .join('/');

module.exports = { DEFAULT_SETTINGS, sanitizeFolder };
