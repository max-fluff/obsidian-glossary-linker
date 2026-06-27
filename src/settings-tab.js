'use strict';

const { PluginSettingTab, Setting, Notice } = require('obsidian');
const { sanitizeFolder } = require('./constants');
const { FolderSuggest, folderSuggestAvailable } = require('./folder-suggest');

class GlossaryLinkerSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = async (rebuild) => { await this.plugin.saveSettings(); if (rebuild) this.plugin.rebuildIndex(); };

    containerEl.createEl('h3', { text: 'Scope' });

    new Setting(containerEl)
      .setName('Glossary folder')
      .setDesc('Folder with one note per term (file name = the term title).')
      .addText((t) => {
        t.setValue(s.glossaryFolder).onChange(async (v) => { s.glossaryFolder = sanitizeFolder(v); await save(true); this.renderFolderStatus(); });
        if (folderSuggestAvailable()) new FolderSuggest(this.app, t.inputEl);
      });

    this.folderStatusEl = containerEl.createEl('div', { cls: 'glossary-section-desc' });
    this.renderFolderStatus();

    new Setting(containerEl)
      .setName('Link scope')
      .setDesc('Which notes terms are highlighted and linked in.')
      .addDropdown((d) => d
        .addOption('folders', 'Listed folders only')
        .addOption('except', 'Everywhere except listed')
        .addOption('vault', 'Everywhere')
        .setValue(s.scopeMode)
        .onChange(async (v) => { s.scopeMode = v; await save(false); this.display(); }));

    if (s.scopeMode !== 'vault') {
      new Setting(containerEl)
        .setName(s.scopeMode === 'except' ? 'Folders to exclude' : 'Folders to include')
        .setDesc(s.scopeMode === 'except'
          ? 'One folder path per line. These folders are skipped; everything else is in scope.'
          : 'One folder path per line. Only notes inside these folders are in scope.')
        .addTextArea((t) => { t.setValue(s.scopeFolders).onChange(async (v) => { s.scopeFolders = v; await save(false); }); t.inputEl.rows = 5; });
    }

    new Setting(containerEl)
      .setName('Always-excluded folders')
      .setDesc('One folder path per line, never highlighted, linked or scanned, whatever the mode above is.')
      .addTextArea((t) => { t.setValue(s.excludeFolders).onChange(async (v) => { s.excludeFolders = v; await save(false); }); t.inputEl.rows = 3; });

    containerEl.createEl('h3', { text: 'Matching' });

    new Setting(containerEl)
      .setName('Morphology')
      .setDesc('How an inflected word is matched to a term.')
      .addDropdown((d) => d
        .addOption('stemmer', 'Stemmer (recommended)')
        .addOption('endingStrip', 'Ending strip')
        .addOption('exact', 'Exact match')
        .setValue(s.matchMode)
        .onChange(async (v) => { s.matchMode = v; await save(true); }));

    const langs = this.plugin.languages;
    const errors = this.plugin.languageErrors || [];
    const enabledCount = langs.filter((l) => (s.enabledLanguages || []).includes(l.id)).length;
    if (this.showLanguages === undefined) this.showLanguages = false;

    const langDesc = `Bundled morphology modules — ${enabledCount} of ${langs.length} enabled`
      + (errors.length ? `, ${errors.length} invalid` : '') + '.';

    new Setting(containerEl)
      .setName('Languages')
      .setDesc(langDesc)
      .addExtraButton((b) => b.setIcon(this.showLanguages ? 'chevron-up' : 'chevron-down')
        .setTooltip(this.showLanguages ? 'Hide languages' : 'Show languages')
        .onClick(() => { this.showLanguages = !this.showLanguages; this.display(); }));

    if (this.showLanguages) {
      langs.forEach((lang, i) => {
        const row = new Setting(containerEl)
          .setName(lang.name)
          .setDesc(`id: ${lang.id}`)
          .addExtraButton((b) => b.setIcon('chevron-up').setTooltip('Higher priority').setDisabled(i === 0)
            .onClick(async () => { this.plugin.moveLanguage(lang.id, -1); await this.applyLanguageChange(); }))
          .addExtraButton((b) => b.setIcon('chevron-down').setTooltip('Lower priority').setDisabled(i === langs.length - 1)
            .onClick(async () => { this.plugin.moveLanguage(lang.id, 1); await this.applyLanguageChange(); }))
          .addToggle((t) => t.setValue((s.enabledLanguages || []).includes(lang.id)).onChange(async (v) => {
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
          .setDesc(`Invalid module: ${bad.error}`)
          .addExtraButton((b) => b.setIcon('alert-triangle').setTooltip(`Invalid module: ${bad.error}`).setDisabled(true));
        row.nameEl.addClass('glossary-lang-error');
        row.settingEl.addClass('glossary-lang-row');
        row.settingEl.addClass('mod-warning');
      }
    }

    new Setting(containerEl)
      .setName('Link first occurrence only')
      .setDesc('When turning terms into links, link only the first occurrence of each term on a page.')
      .addToggle((t) => t.setValue(s.linkFirstOnly).onChange(async (v) => { s.linkFirstOnly = v; await save(false); }));

    new Setting(containerEl)
      .setName('Excluded terms')
      .setDesc('Term titles or aliases, one per line — drops the whole matching entry from the index.')
      .addTextArea((t) => { t.setValue(s.excludeTerms).onChange(async (v) => { s.excludeTerms = v; await save(true); }); t.inputEl.rows = 3; });

    new Setting(containerEl)
      .setName('Excluded words')
      .setDesc('Surface words, one per line, that never trigger a link even if they match a term.')
      .addTextArea((t) => { t.setValue(s.excludeWords).onChange(async (v) => { s.excludeWords = v; await save(true); }); t.inputEl.rows = 3; });

    containerEl.createEl('h3', { text: 'Highlighting' });

    new Setting(containerEl)
      .setName('Highlight in Reading view')
      .setDesc('Underline detected terms as clickable links in Reading view (file unchanged).')
      .addToggle((t) => t.setValue(s.highlightInReading).onChange(async (v) => { s.highlightInReading = v; await save(false); this.plugin.rerenderViews(); }));

    new Setting(containerEl)
      .setName('Highlight while editing')
      .setDesc('Underline terms in the editor (Live Preview / Source) too.')
      .addDropdown((d) => d
        .addOption('off', 'Off')
        .addOption('live', 'Live (as you type)')
        .addOption('onSave', 'On save')
        .setValue(s.editingHighlight)
        .onChange(async (v) => { s.editingHighlight = v; await save(false); this.plugin.refreshEditors(); }));

    new Setting(containerEl)
      .setName('Skip headings')
      .setDesc('Do not highlight or link terms that appear inside Markdown headings.')
      .addToggle((t) => t.setValue(s.skipHeadings).onChange(async (v) => { s.skipHeadings = v; await save(false); this.plugin.rerenderViews(); }));

    new Setting(containerEl)
      .setName('Status bar count')
      .setDesc('Show how many glossary terms are on the current note in the status bar.')
      .addToggle((t) => t.setValue(s.statusBar).onChange(async (v) => { s.statusBar = v; await save(false); this.plugin.updateStatusBar(); }));

    new Setting(containerEl)
      .setName('Count direct links')
      .setDesc('Also count terms already linked directly, not only plain-text mentions.')
      .addToggle((t) => t.setValue(s.statusBarIncludeLinks).onChange(async (v) => { s.statusBarIncludeLinks = v; await save(false); this.plugin.updateStatusBar(); }));

    containerEl.createEl('h3', { text: 'Autocomplete' });

    new Setting(containerEl)
      .setName('Suggest links while typing')
      .setDesc('As you type in an in-scope note, offer to insert a [[link]] to a matching glossary term (prefix of a title/alias, or an inflected form).')
      .addToggle((t) => t.setValue(s.linkSuggest).onChange(async (v) => { s.linkSuggest = v; await save(false); }));

    new Setting(containerEl)
      .setName('Minimum characters')
      .setDesc('How many characters to type before suggestions appear.')
      .addText((t) => { t.inputEl.type = 'number'; t.inputEl.min = '1'; t.setValue(String(s.suggestMinChars)).onChange(async (v) => { const n = parseInt(v, 10); s.suggestMinChars = Number.isFinite(n) && n > 0 ? n : 1; await save(false); }); });

    containerEl.createEl('h3', { text: 'Collecting aliases' });
    containerEl.createEl('div', { cls: 'glossary-section-desc', text: 'Reads the links you already made by hand, like [[Term|some wording]], and adds that wording to the term\'s aliases — so the same wording links automatically next time.' });

    new Setting(containerEl)
      .setName('Alias form')
      .setDesc('How collected link text is stored as an alias.')
      .addDropdown((d) => d
        .addOption('lemma', 'Base form')
        .addOption('literal', 'As written')
        .addOption('both', 'Both')
        .setValue(s.aliasHarvestMode)
        .onChange(async (v) => { s.aliasHarvestMode = v; await save(false); }));

    new Setting(containerEl)
      .setName('Collect on save')
      .setDesc('Collect aliases automatically when a note is saved.')
      .addDropdown((d) => d
        .addOption('off', 'Off')
        .addOption('silent', 'Silent (add automatically)')
        .addOption('preview', 'Ask first')
        .setValue(s.harvestOnSave)
        .onChange(async (v) => { s.harvestOnSave = v; await save(false); }));

    new Setting(containerEl)
      .setName('Single-word aliases only')
      .setDesc('Only collect link texts that are a single word.')
      .addToggle((t) => t.setValue(s.harvestSingleWordOnly).onChange(async (v) => { s.harvestSingleWordOnly = v; await save(false); }));

    new Setting(containerEl)
      .setName('Minimum alias length')
      .setDesc('Ignore collected aliases shorter than this many characters.')
      .addText((t) => { t.inputEl.type = 'number'; t.inputEl.min = '1'; t.setValue(String(s.harvestMinLength)).onChange(async (v) => { const n = parseInt(v, 10); s.harvestMinLength = Number.isFinite(n) && n > 0 ? n : 1; await save(false); }); });

    new Setting(containerEl)
      .setName('Warn about alias collisions')
      .setDesc('When collecting an alias or creating a term, flag wording that already matches a different term (so you can avoid making a word point at two terms).')
      .addToggle((t) => t.setValue(s.aliasCollisionWarnings).onChange(async (v) => { s.aliasCollisionWarnings = v; await save(false); }));

    containerEl.createEl('h3', { text: 'Context menu' });

    new Setting(containerEl)
      .setName('"Turn into links" items')
      .setDesc('Show the "Turn into link" / "Turn all … into links" actions when right-clicking a highlighted term.')
      .addToggle((t) => t.setValue(s.menuTurnInto).onChange(async (v) => { s.menuTurnInto = v; await save(false); }));

    new Setting(containerEl)
      .setName('"Collect aliases" item')
      .setDesc('Show "Collect aliases from links (this note)" in the editor right-click menu.')
      .addToggle((t) => t.setValue(s.menuCollect).onChange(async (v) => { s.menuCollect = v; await save(false); }));

    new Setting(containerEl)
      .setName('"Exclude word / term" items')
      .setDesc('Show "Add … to excluded words / terms" when right-clicking a term, and "Add … to excluded words" on a selected word.')
      .addToggle((t) => t.setValue(s.menuExclude).onChange(async (v) => { s.menuExclude = v; await save(false); }));

    new Setting(containerEl)
      .setName('"Open glossary note" items')
      .setDesc('Show "Open glossary note" / "Open in new tab" when right-clicking a highlighted term.')
      .addToggle((t) => t.setValue(s.menuOpen).onChange(async (v) => { s.menuOpen = v; await save(false); }));

    new Setting(containerEl)
      .setName('"Create term from selection" items')
      .setDesc('Show the "Glossary: create term…" actions when right-clicking a plain text selection.')
      .addToggle((t) => t.setValue(s.menuCreateTerm).onChange(async (v) => { s.menuCreateTerm = v; await save(false); }));

    containerEl.createEl('h3', { text: 'Maintenance' });

    new Setting(containerEl)
      .setName('Rebuild glossary index')
      .setDesc('Re-scan the glossary folder now.')
      .addButton((b) => b.setButtonText('Rebuild').onClick(() => { this.plugin.rebuildIndex(); new Notice('Glossary Linker: index rebuilt'); this.renderFolderStatus(); }));
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
    const isFolder = !!f && f.children !== undefined; // TFolder exposes children
    if (!isFolder) {
      el.addClass('glossary-lang-error');
      el.setText('⚠ Folder not found — no terms will be indexed.');
      return;
    }
    const n = (this.plugin.index && this.plugin.index.termCount) || 0;
    el.setText(`${n} term${n === 1 ? '' : 's'} indexed.`);
  }
}

module.exports = { GlossaryLinkerSettingTab };
