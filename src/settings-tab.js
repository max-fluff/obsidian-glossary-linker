'use strict';

const { PluginSettingTab, Setting, Notice, TFolder } = require('obsidian');
const { sanitizeFolder } = require('./constants');
const { FolderSuggest, FileSuggest, PathSuggest, folderSuggestAvailable } = require('./shared/prose/folder-suggest');
const { t, plural } = require('./shared/i18n');
const { renderPrecedenceSetting } = require('./shared/precedence');
const { createProseSettings } = require('./shared/prose/settings');

class GlossaryLinkerSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    // A rebuild changes what matches, so also refresh open views and the status bar.
    const save = async (rebuild) => {
      await this.plugin.saveSettings();
      if (rebuild) { this.plugin.rebuildIndex(); this.plugin.rerenderViews(); this.plugin.updateStatusBar(); }
    };
    // Scope changes don't touch the term index, so refresh views without a rebuild.
    const saveScope = async () => { await this.plugin.saveSettings(); this.plugin.rerenderViews(); this.plugin.updateStatusBar(); this.plugin.refreshOverviewDebounced(); };

    const sections = createProseSettings(this, { cls: 'glossary', save });

    new Setting(containerEl).setName(t('set.heading.scope')).setHeading();

    new Setting(containerEl)
      .setName(t('set.glossaryFolder.name'))
      .setDesc(t('set.glossaryFolder.desc'))
      .addText((c) => {
        c.setValue(s.glossaryFolder).onChange(async (v) => { s.glossaryFolder = sanitizeFolder(v); await save(true); this.renderFolderStatus(); this.plugin.refreshOverviewDebounced(); });
        if (folderSuggestAvailable()) new FolderSuggest(this.app, c.inputEl);
      });

    new Setting(containerEl)
      .setName(t('set.termTemplate.name'))
      .setDesc(t('set.termTemplate.desc'))
      .addText((c) => {
        c.setValue(s.termTemplate).onChange(async (v) => { s.termTemplate = v.trim(); await save(false); });
        if (folderSuggestAvailable()) new FileSuggest(this.app, c.inputEl);
      });

    sections.scopeMode(containerEl, saveScope);

    const folderList = (name, desc, key) => sections.pathList(containerEl, {
      name,
      desc,
      key,
      labels: 'folderList',
      normalize: sanitizeFolder,
      attachSuggest: folderSuggestAvailable()
        ? (inputEl, onPick) => new PathSuggest(this.app, inputEl, onPick)
        : null,
      save: saveScope,
    });

    if (s.scopeMode === 'folders') {
      folderList(t('set.scopeFolders.name'), t('set.scopeFolders.desc'), 'scopeFolders');
    }

    folderList(t('set.excludeFolders.name'), t('set.excludeFolders.desc'), 'excludeFolders');

    this.folderStatusEl = containerEl.createEl('div', { cls: 'glossary-section-desc' });
    this.renderFolderStatus();

    new Setting(containerEl).setName(t('set.heading.matching')).setHeading();

    sections.matchMode(containerEl);
    sections.languages(containerEl);
    sections.matchLimits(containerEl);

    new Setting(containerEl)
      .setName(t('set.excludeWords.name'))
      .setDesc(t('set.excludeWords.desc'))
      .addTextArea((c) => { c.setValue(s.excludeWords).onChange(async (v) => { s.excludeWords = v; await save(true); }); c.inputEl.rows = 3; });

    sections.highlighting(containerEl);
    sections.autocomplete(containerEl);

    new Setting(containerEl).setName(t('set.heading.collecting')).setDesc(t('set.collecting.desc')).setHeading();

    new Setting(containerEl)
      .setName(t('set.aliasHarvestMode.name'))
      .setDesc(t('set.aliasHarvestMode.desc'))
      .addDropdown((d) => d
        .addOption('lemma', t('set.aliasHarvestMode.lemma'))
        .addOption('literal', t('set.aliasHarvestMode.literal'))
        .addOption('both', t('set.aliasHarvestMode.both'))
        .setValue(s.aliasHarvestMode)
        .onChange(async (v) => { s.aliasHarvestMode = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.harvestOnSave.name'))
      .setDesc(t('set.harvestOnSave.desc'))
      .addDropdown((d) => d
        .addOption('off', t('set.harvestOnSave.off'))
        .addOption('silent', t('set.harvestOnSave.silent'))
        .addOption('preview', t('set.harvestOnSave.preview'))
        .setValue(s.harvestOnSave)
        .onChange(async (v) => { s.harvestOnSave = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.harvestSingleWordOnly.name'))
      .setDesc(t('set.harvestSingleWordOnly.desc'))
      .addToggle((c) => c.setValue(s.harvestSingleWordOnly).onChange(async (v) => { s.harvestSingleWordOnly = v; await save(false); }));

    sections.positiveNumber(containerEl, 'harvestMinLength', false);

    new Setting(containerEl)
      .setName(t('set.aliasCollisionWarnings.name'))
      .setDesc(t('set.aliasCollisionWarnings.desc'))
      .addToggle((c) => c.setValue(s.aliasCollisionWarnings).onChange(async (v) => { s.aliasCollisionWarnings = v; await save(false); }));

    sections.menuToggles(containerEl, ['menuTurnInto', 'menuCollect', 'menuExclude', 'menuOpen', 'menuCreateTerm', 'menuAddAlias', 'menuUnlink']);

    new Setting(containerEl).setName(t('set.heading.overview')).setHeading();

    new Setting(containerEl)
      .setName(t('set.showRibbonIcon.name'))
      .setDesc(t('set.showRibbonIcon.desc'))
      .addToggle((c) => c.setValue(s.showRibbonIcon).onChange(async (v) => { s.showRibbonIcon = v; await save(false); this.plugin.applyRibbonIcon(); }));

    new Setting(containerEl).setName(t('set.heading.maintenance')).setHeading();

    // First thing in Maintenance, in the same place in all four plugins: it is a
    // vault-wide arrangement between plugins rather than a knob for this one, and it
    // renders nothing at all unless another linker is installed.
    renderPrecedenceSetting(containerEl, {
      app: this.app,
      provider: this.plugin.api && this.plugin.api.linker,
      Setting,
      cls: 'glossary',
      save: async (value) => { s.linkPrecedence = value; await save(false); },
    });

    new Setting(containerEl)
      .setName(t('set.rebuild.name'))
      .setDesc(t('set.rebuild.desc'))
      .addButton((b) => b.setButtonText(t('set.rebuild.button')).onClick(() => { this.plugin.rebuildIndex(); new Notice(t('notice.indexRebuilt')); this.renderFolderStatus(); }));
  }

  renderFolderStatus() {
    const el = this.folderStatusEl;
    if (!el) return;
    el.empty();
    el.removeClass('glossary-lang-error');
    const path = (this.plugin.settings.glossaryFolder || '').replace(/\/+$/, '');
    const n = (this.plugin.index && this.plugin.index.termCount) || 0;
    if (!path) {
      // Empty folder = whole vault is the glossary, not a missing folder.
      el.setText(t('set.wholeVaultStatus', { terms: plural('term', n) }));
      return;
    }
    const f = this.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFolder)) {
      el.addClass('glossary-lang-error');
      el.setText(t('set.folderNotFound'));
      return;
    }
    el.setText(t('set.termsIndexed', { terms: plural('term', n) }));
  }
}

module.exports = { GlossaryLinkerSettingTab };
