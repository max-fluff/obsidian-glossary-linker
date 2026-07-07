'use strict';

const { PluginSettingTab, Setting, Notice, TFolder } = require('obsidian');
const { sanitizeFolder } = require('./constants');
const { FolderSuggest, FileSuggest, folderSuggestAvailable } = require('./folder-suggest');
const { t, plural } = require('./i18n');

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

    new Setting(containerEl).setName(t('set.heading.scope')).setHeading();

    new Setting(containerEl)
      .setName(t('set.glossaryFolder.name'))
      .setDesc(t('set.glossaryFolder.desc'))
      .addText((c) => {
        c.setValue(s.glossaryFolder).onChange(async (v) => { s.glossaryFolder = sanitizeFolder(v); await save(true); this.renderFolderStatus(); this.plugin.refreshOverviewDebounced(); });
        if (folderSuggestAvailable()) new FolderSuggest(this.app, c.inputEl);
      });

    this.folderStatusEl = containerEl.createEl('div', { cls: 'glossary-section-desc' });
    this.renderFolderStatus();

    new Setting(containerEl)
      .setName(t('set.termTemplate.name'))
      .setDesc(t('set.termTemplate.desc'))
      .addText((c) => {
        c.setValue(s.termTemplate).onChange(async (v) => { s.termTemplate = v.trim(); await save(false); });
        if (folderSuggestAvailable()) new FileSuggest(this.app, c.inputEl);
      });

    new Setting(containerEl)
      .setName(t('set.scopeMode.name'))
      .setDesc(t('set.scopeMode.desc'))
      .addDropdown((d) => d
        .addOption('folders', t('set.scopeMode.folders'))
        .addOption('vault', t('set.scopeMode.vault'))
        .setValue(s.scopeMode)
        .onChange(async (v) => { s.scopeMode = v; await saveScope(); this.display(); }));

    if (s.scopeMode === 'folders') {
      new Setting(containerEl)
        .setName(t('set.scopeFolders.name'))
        .setDesc(t('set.scopeFolders.desc'))
        .addTextArea((c) => { c.setValue(s.scopeFolders).onChange(async (v) => { s.scopeFolders = v; await saveScope(); }); c.inputEl.rows = 5; });
    }

    new Setting(containerEl)
      .setName(t('set.excludeFolders.name'))
      .setDesc(t('set.excludeFolders.desc'))
      .addTextArea((c) => { c.setValue(s.excludeFolders).onChange(async (v) => { s.excludeFolders = v; await saveScope(); }); c.inputEl.rows = 3; });

    new Setting(containerEl).setName(t('set.heading.matching')).setHeading();

    new Setting(containerEl)
      .setName(t('set.matchMode.name'))
      .setDesc(t('set.matchMode.desc'))
      .addDropdown((d) => d
        .addOption('stemmer', t('set.matchMode.stemmer'))
        .addOption('endingStrip', t('set.matchMode.endingStrip'))
        .addOption('exact', t('set.matchMode.exact'))
        .setValue(s.matchMode)
        .onChange(async (v) => { s.matchMode = v; await save(true); }));

    new Setting(containerEl)
      .setName(t('set.minTermLength.name'))
      .setDesc(t('set.minTermLength.desc'))
      .addText((c) => { c.inputEl.type = 'number'; c.inputEl.min = '1'; c.setValue(String(s.minTermLength)).onChange(async (v) => { const n = parseInt(v, 10); s.minTermLength = Number.isFinite(n) && n > 0 ? n : 1; await save(true); }); });

    const langs = this.plugin.languages;
    const errors = this.plugin.languageErrors || [];
    const enabledCount = langs.filter((l) => (s.enabledLanguages || []).includes(l.id)).length;
    if (this.showLanguages === undefined) this.showLanguages = false;

    const langDesc = t('set.languages.desc', { enabled: enabledCount, total: langs.length })
      + (errors.length ? t('set.languages.invalidSuffix', { n: errors.length }) : '') + '.';

    new Setting(containerEl)
      .setName(t('set.languages.name'))
      .setDesc(langDesc)
      .addExtraButton((b) => b.setIcon(this.showLanguages ? 'chevron-up' : 'chevron-down')
        .setTooltip(this.showLanguages ? t('set.languages.hide') : t('set.languages.show'))
        .onClick(() => { this.showLanguages = !this.showLanguages; this.display(); }));

    if (this.showLanguages) {
      langs.forEach((lang, i) => {
        const row = new Setting(containerEl)
          .setName(lang.name)
          .setDesc(`id: ${lang.id}`)
          .addExtraButton((b) => b.setIcon('chevron-up').setTooltip(t('set.lang.higher')).setDisabled(i === 0)
            .onClick(async () => { this.plugin.moveLanguage(lang.id, -1); await this.applyLanguageChange(); }))
          .addExtraButton((b) => b.setIcon('chevron-down').setTooltip(t('set.lang.lower')).setDisabled(i === langs.length - 1)
            .onClick(async () => { this.plugin.moveLanguage(lang.id, 1); await this.applyLanguageChange(); }))
          .addToggle((c) => c.setValue((s.enabledLanguages || []).includes(lang.id)).onChange(async (v) => {
            const set = new Set(s.enabledLanguages || []);
            if (v) set.add(lang.id); else set.delete(lang.id);
            s.enabledLanguages = [...set];
            await this.applyLanguageChange();
          }));
        row.settingEl.addClass('glossary-lang-row');
      });
      for (const bad of errors) {
        const row = new Setting(containerEl)
          .setName(bad.id)
          .setDesc(t('set.lang.invalid', { error: bad.error }))
          .addExtraButton((b) => b.setIcon('alert-triangle').setTooltip(t('set.lang.invalid', { error: bad.error })).setDisabled(true));
        row.nameEl.addClass('glossary-lang-error');
        row.settingEl.addClass('glossary-lang-row');
        row.settingEl.addClass('mod-warning');
      }
    }

    new Setting(containerEl)
      .setName(t('set.linkFirstOnly.name'))
      .setDesc(t('set.linkFirstOnly.desc'))
      .addToggle((c) => c.setValue(s.linkFirstOnly).onChange(async (v) => { s.linkFirstOnly = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.excludeTerms.name'))
      .setDesc(t('set.excludeTerms.desc'))
      .addTextArea((c) => { c.setValue(s.excludeTerms).onChange(async (v) => { s.excludeTerms = v; await save(true); }); c.inputEl.rows = 3; });

    new Setting(containerEl)
      .setName(t('set.excludeWords.name'))
      .setDesc(t('set.excludeWords.desc'))
      .addTextArea((c) => { c.setValue(s.excludeWords).onChange(async (v) => { s.excludeWords = v; await save(true); }); c.inputEl.rows = 3; });

    new Setting(containerEl).setName(t('set.heading.highlighting')).setHeading();

    new Setting(containerEl)
      .setName(t('set.highlightInReading.name'))
      .setDesc(t('set.highlightInReading.desc'))
      .addToggle((c) => c.setValue(s.highlightInReading).onChange(async (v) => { s.highlightInReading = v; await save(false); this.plugin.rerenderViews(); }));

    new Setting(containerEl)
      .setName(t('set.editingHighlight.name'))
      .setDesc(t('set.editingHighlight.desc'))
      .addDropdown((d) => d
        .addOption('off', t('set.editingHighlight.off'))
        .addOption('live', t('set.editingHighlight.live'))
        .addOption('onSave', t('set.editingHighlight.onSave'))
        .setValue(s.editingHighlight)
        .onChange(async (v) => { s.editingHighlight = v; await save(false); this.plugin.refreshEditors(); }));

    new Setting(containerEl)
      .setName(t('set.skipHeadings.name'))
      .setDesc(t('set.skipHeadings.desc'))
      .addToggle((c) => c.setValue(s.skipHeadings).onChange(async (v) => { s.skipHeadings = v; await save(false); this.plugin.rerenderViews(); }));

    new Setting(containerEl)
      .setName(t('set.statusBar.name'))
      .setDesc(t('set.statusBar.desc'))
      .addToggle((c) => c.setValue(s.statusBar).onChange(async (v) => { s.statusBar = v; await save(false); this.plugin.updateStatusBar(); }));

    new Setting(containerEl)
      .setName(t('set.statusBarIncludeLinks.name'))
      .setDesc(t('set.statusBarIncludeLinks.desc'))
      .addToggle((c) => c.setValue(s.statusBarIncludeLinks).onChange(async (v) => { s.statusBarIncludeLinks = v; await save(false); this.plugin.updateStatusBar(); }));

    new Setting(containerEl).setName(t('set.heading.autocomplete')).setHeading();

    new Setting(containerEl)
      .setName(t('set.linkSuggest.name'))
      .setDesc(t('set.linkSuggest.desc'))
      .addToggle((c) => c.setValue(s.linkSuggest).onChange(async (v) => { s.linkSuggest = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.suggestMinChars.name'))
      .setDesc(t('set.suggestMinChars.desc'))
      .addText((c) => { c.inputEl.type = 'number'; c.inputEl.min = '1'; c.setValue(String(s.suggestMinChars)).onChange(async (v) => { const n = parseInt(v, 10); s.suggestMinChars = Number.isFinite(n) && n > 0 ? n : 1; await save(false); }); });

    new Setting(containerEl)
      .setName(t('set.suggestSkipAfter.name'))
      .setDesc(t('set.suggestSkipAfter.desc'))
      .addText((c) => c.setValue(s.suggestSkipAfter).onChange(async (v) => { s.suggestSkipAfter = v; await save(false); }));

    new Setting(containerEl).setName(t('set.heading.collecting')).setHeading();
    containerEl.createEl('div', { cls: 'glossary-section-desc', text: t('set.collecting.desc') });

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

    new Setting(containerEl)
      .setName(t('set.harvestMinLength.name'))
      .setDesc(t('set.harvestMinLength.desc'))
      .addText((c) => { c.inputEl.type = 'number'; c.inputEl.min = '1'; c.setValue(String(s.harvestMinLength)).onChange(async (v) => { const n = parseInt(v, 10); s.harvestMinLength = Number.isFinite(n) && n > 0 ? n : 1; await save(false); }); });

    new Setting(containerEl)
      .setName(t('set.aliasCollisionWarnings.name'))
      .setDesc(t('set.aliasCollisionWarnings.desc'))
      .addToggle((c) => c.setValue(s.aliasCollisionWarnings).onChange(async (v) => { s.aliasCollisionWarnings = v; await save(false); }));

    new Setting(containerEl).setName(t('set.heading.contextMenu')).setHeading();

    new Setting(containerEl)
      .setName(t('set.menuTurnInto.name'))
      .setDesc(t('set.menuTurnInto.desc'))
      .addToggle((c) => c.setValue(s.menuTurnInto).onChange(async (v) => { s.menuTurnInto = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.menuCollect.name'))
      .setDesc(t('set.menuCollect.desc'))
      .addToggle((c) => c.setValue(s.menuCollect).onChange(async (v) => { s.menuCollect = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.menuExclude.name'))
      .setDesc(t('set.menuExclude.desc'))
      .addToggle((c) => c.setValue(s.menuExclude).onChange(async (v) => { s.menuExclude = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.menuOpen.name'))
      .setDesc(t('set.menuOpen.desc'))
      .addToggle((c) => c.setValue(s.menuOpen).onChange(async (v) => { s.menuOpen = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.menuCreateTerm.name'))
      .setDesc(t('set.menuCreateTerm.desc'))
      .addToggle((c) => c.setValue(s.menuCreateTerm).onChange(async (v) => { s.menuCreateTerm = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.menuAddAbbreviation.name'))
      .setDesc(t('set.menuAddAbbreviation.desc'))
      .addToggle((c) => c.setValue(s.menuAddAbbreviation).onChange(async (v) => { s.menuAddAbbreviation = v; await save(false); }));

    new Setting(containerEl)
      .setName(t('set.menuUnlink.name'))
      .setDesc(t('set.menuUnlink.desc'))
      .addToggle((c) => c.setValue(s.menuUnlink).onChange(async (v) => { s.menuUnlink = v; await save(false); }));

    new Setting(containerEl).setName(t('set.heading.overview')).setHeading();

    new Setting(containerEl)
      .setName(t('set.showRibbonIcon.name'))
      .setDesc(t('set.showRibbonIcon.desc'))
      .addToggle((c) => c.setValue(s.showRibbonIcon).onChange(async (v) => { s.showRibbonIcon = v; await save(false); this.plugin.applyRibbonIcon(); }));

    new Setting(containerEl).setName(t('set.heading.maintenance')).setHeading();

    new Setting(containerEl)
      .setName(t('set.rebuild.name'))
      .setDesc(t('set.rebuild.desc'))
      .addButton((b) => b.setButtonText(t('set.rebuild.button')).onClick(() => { this.plugin.rebuildIndex(); new Notice(t('notice.indexRebuilt')); this.renderFolderStatus(); }));
  }

  async applyLanguageChange() {
    await this.plugin.saveSettings();
    this.plugin.refreshActiveLanguages();
    this.plugin.rebuildIndex();
    this.plugin.rerenderViews();
    this.display();
  }

  renderFolderStatus() {
    const el = this.folderStatusEl;
    if (!el) return;
    el.empty();
    el.removeClass('glossary-lang-error');
    const path = (this.plugin.settings.glossaryFolder || '').replace(/\/+$/, '');
    const f = path ? this.app.vault.getAbstractFileByPath(path) : null;
    const isFolder = f instanceof TFolder;
    if (!isFolder) {
      el.addClass('glossary-lang-error');
      el.setText(t('set.folderNotFound'));
      return;
    }
    const n = (this.plugin.index && this.plugin.index.termCount) || 0;
    el.setText(t('set.termsIndexed', { terms: plural('term', n) }));
  }
}

module.exports = { GlossaryLinkerSettingTab };
