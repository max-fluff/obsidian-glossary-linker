'use strict';

// The tab is assembled from shared section renderers, so a rename on either side breaks it
// only when the reader opens Settings — nothing else in the suite constructs it. This runs
// display() end to end and checks the sections still arrive, in order.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs, obsidianStub, RecordingSetting, elLike } = require('../src/shared/testing/stubs');

installStubs();

obsidianStub.Setting = RecordingSetting;

const { t } = require('../src/shared/i18n');
const { GlossaryLinkerSettingTab } = require(path.join(__dirname, '..', 'src', 'settings-tab.js'));


// Only what display() reaches for. An empty glossary folder means "whole vault", which is
// the status line's default branch.
function fakePlugin() {
  return {
    settings: {
      glossaryFolder: '', termTemplate: '',
      scopeMode: 'folders', scopeFolders: '', excludeFolders: '',
      matchMode: 'stemmer', minTermLength: 3,
      enabledLanguages: [], linkFirstOnly: false, excludeTerms: '', excludeWords: '',
      highlightInReading: true, editingHighlight: 'live', skipHeadings: false,
      statusBar: true, statusBarIncludeLinks: false,
      linkSuggest: true, suggestMinChars: 2, suggestSkipAfter: '',
      aliasHarvestMode: 'lemma', harvestOnSave: 'off', harvestSingleWordOnly: true,
      harvestMinLength: 3, aliasCollisionWarnings: true,
      menuTurnInto: true, menuCollect: true, menuExclude: true, menuOpen: true,
      menuCreateTerm: true, menuAddAlias: true, menuUnlink: true,
      showRibbonIcon: true, linkPrecedence: 0,
    },
    languages: [],
    languageErrors: [],
    index: { termCount: 0 },
    api: { linker: { id: 'glossary-linker', precedence: 0 } },
    saveSettings: async () => {},
    rebuildIndex: () => {},
    rerenderViews: () => {},
    refreshEditors: () => {},
    updateStatusBar: () => {},
    refreshActiveLanguages: () => {},
    refreshOverviewDebounced: () => {},
    applyRibbonIcon: () => {},
    moveLanguage: () => {},
  };
}

describe('settings tab', () => {
  it('renders every section without throwing', () => {
    RecordingSetting.reset();
    const tab = new GlossaryLinkerSettingTab(fakeApp, fakePlugin());
    tab.containerEl = elLike();
    tab.display();

    const headings = RecordingSetting.entries.filter((e) => e.heading).map((e) => e.name);
    assert.deepStrictEqual(headings, [
      t('set.heading.scope'),
      t('set.heading.matching'),
      t('set.heading.highlighting'),
      t('set.heading.autocomplete'),
      t('set.heading.collecting'),
      t('set.heading.contextMenu'),
      t('set.heading.overview'),
      t('set.heading.maintenance'),
    ]);
  });

  it('keeps its own settings alongside the shared ones', () => {
    RecordingSetting.reset();
    const tab = new GlossaryLinkerSettingTab(fakeApp, fakePlugin());
    tab.containerEl = elLike();
    tab.display();

    const names = RecordingSetting.names();
    // Shared sections.
    assert.ok(names.includes(t('set.matchMode.name')), 'shared matching section missing');
    assert.ok(names.includes(t('set.linkSuggest.name')), 'shared autocomplete section missing');
    assert.ok(names.includes(t('set.menuAddAlias.name')), 'shared menu toggles missing');
    // Glossary-only ones the shared renderers know nothing about.
    assert.ok(names.includes(t('set.glossaryFolder.name')), 'glossary folder missing');
    assert.ok(names.includes(t('set.excludeWords.name')), 'exclude words missing');
    assert.ok(names.includes(t('set.harvestOnSave.name')), 'harvest settings missing');
  });

  // excludeWords sits immediately after the shared exclusion box; the pair reads as one
  // thing and a stray section between them would be a regression, not a reshuffle.
  it('keeps the two exclusion boxes together', () => {
    RecordingSetting.reset();
    const tab = new GlossaryLinkerSettingTab(fakeApp, fakePlugin());
    tab.containerEl = elLike();
    tab.display();

    const names = RecordingSetting.names();
    assert.strictEqual(names.indexOf(t('set.excludeWords.name')), names.indexOf(t('set.excludeTerms.name')) + 1);
  });
});
