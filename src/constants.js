'use strict';

const DEFAULT_SETTINGS = {
  glossaryFolder: 'glossary',
  scopeMode: 'vault', // 'folders' | 'except' | 'vault'
  scopeFolders: '',
  excludeFolders: '',
  matchMode: 'stemmer', // 'stemmer' | 'endingStrip' | 'exact'
  enabledLanguages: null, // null until first-run defaults are picked
  languageOrder: [], // ids in priority order (first = highest); overrides module defaults
  aliasHarvestMode: 'lemma', // 'lemma' | 'literal' | 'both'
  harvestOnSave: 'off', // 'off' | 'silent' | 'preview'
  harvestSingleWordOnly: true,
  harvestMinLength: 2,
  excludeTerms: '',
  excludeWords: '',
  linkFirstOnly: false,
  linkSuggest: false, // offer [[link]] autocomplete while typing
  suggestMinChars: 3, // min typed length before autocomplete triggers
  aliasCollisionWarnings: true, // warn when a collected/created alias collides with another term
  highlightInReading: true,
  editingHighlight: 'live', // 'off' | 'live' | 'onSave'
  skipHeadings: true,
  statusBar: true,
  statusBarIncludeLinks: true,
  menuTurnInto: true,
  menuCollect: true,
  menuOpen: true,
  menuCreateTerm: true,
  menuExclude: true,
};

const splitLines = (s) => (s || '').split('\n').map((x) => x.trim()).filter(Boolean);

// Drop blank, "." and ".." segments so a stray "../" can't escape the vault.
const sanitizeFolder = (s) => (s || '')
  .split('/')
  .map((x) => x.trim())
  .filter((x) => x && x !== '.' && x !== '..')
  .join('/');

module.exports = { DEFAULT_SETTINGS, splitLines, sanitizeFolder };
