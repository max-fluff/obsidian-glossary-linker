'use strict';

const DEFAULT_SETTINGS = {
  glossaryFolder: 'glossary',
  scopeMode: 'folders', // 'folders' | 'except' | 'vault'
  scopeFolders: 'design\narchitecture\nfeatures\nguides\nvision',
  excludeFolders: '_meta\n_attachments\n.obsidian',
  matchMode: 'stemmer', // 'stemmer' | 'endingStrip' | 'exact'
  enabledLanguages: null, // null = enable everything discovered on first run
  aliasHarvestMode: 'lemma', // 'lemma' | 'literal' | 'both'
  harvestOnSave: 'off', // 'off' | 'silent' | 'preview'
  harvestSingleWordOnly: true,
  harvestMinLength: 2,
  excludeTerms: '',
  excludeWords: '',
  linkFirstOnly: false,
  highlightInReading: true,
  editingHighlight: 'live', // 'off' | 'live' | 'onSave'
  skipHeadings: true,
};

const splitLines = (s) => (s || '').split('\n').map((x) => x.trim()).filter(Boolean);

module.exports = { DEFAULT_SETTINGS, splitLines };
