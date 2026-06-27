'use strict';

const { PluginSettingTab, Setting, Notice } = require('obsidian');

class GlossaryLinkerSettingTab extends PluginSettingTab {
  constructor(app, plugin) { super(app, plugin); this.plugin = plugin; }

  display() {
    const { containerEl } = this;
    containerEl.empty();
    const s = this.plugin.settings;
    const save = async (rebuild) => { await this.plugin.saveSettings(); if (rebuild) this.plugin.rebuildIndex(); };

    // --- Scope ---
    containerEl.createEl('h3', { text: 'Scope' });

    new Setting(containerEl)
      .setName('Glossary folder')
      .setDesc('Folder with one note per term (file name = term title). Both this folder\'s notes and their frontmatter "aliases" build the term index. Path is relative to the vault root.')
      .addText((t) => t.setValue(s.glossaryFolder).onChange(async (v) => { s.glossaryFolder = v.trim(); await save(true); }));

    new Setting(containerEl)
      .setName('Link scope')
      .setDesc('Which notes the plugin highlights terms in and turns them into links. "Listed folders only" restricts to the folders below; "Everywhere except listed" covers the vault but skips the folders below; "Everywhere" covers the whole vault. The always-excluded folders below are removed on top of all three.')
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
      .setDesc('One folder path per line. Never highlighted, linked or scanned, whatever the mode above is. A good place for the .obsidian config folder and attachment folders.')
      .addTextArea((t) => { t.setValue(s.excludeFolders).onChange(async (v) => { s.excludeFolders = v; await save(false); }); t.inputEl.rows = 3; });

    // --- Matching ---
    containerEl.createEl('h3', { text: 'Matching' });

    new Setting(containerEl)
      .setName('Morphology')
      .setDesc('How an inflected word in the text is matched to a term. The actual algorithm comes from the enabled language modules below, picked automatically by the word\'s script. "Stemmer" reduces words to their root (handles declensions and plurals like units → unit) and is recommended. "Ending strip" only chops common endings (lighter, fewer matches). "Exact match" requires the exact term/alias spelling.')
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

    const langDesc = `Morphology modules in the "languages" folder — ${enabledCount} of ${langs.length} enabled`
      + (errors.length ? `, ${errors.length} with errors` : '')
      + '. Disabled languages are matched exactly (no inflection).';

    new Setting(containerEl)
      .setName('Languages')
      .setDesc(langDesc)
      .addExtraButton((b) => b.setIcon('refresh-cw').setTooltip('Reload — re-scan the languages folder').onClick(async () => {
        await this.plugin.loadLanguages();
        this.plugin.rebuildIndex();
        this.display();
      }))
      .addExtraButton((b) => b.setIcon(this.showLanguages ? 'chevron-up' : 'chevron-down')
        .setTooltip(this.showLanguages ? 'Hide languages' : 'Show languages')
        .onClick(() => { this.showLanguages = !this.showLanguages; this.display(); }));

    if (!langs.length && !errors.length) {
      containerEl.createEl('div', { cls: 'glossary-preview-empty', text: 'No language modules found.' });
    }

    if (this.showLanguages) {
      for (const lang of langs) {
        const row = new Setting(containerEl)
          .setName(lang.name)
          .setDesc(`id: ${lang.id}`)
          .addToggle((t) => t.setValue((s.enabledLanguages || []).includes(lang.id)).onChange(async (v) => {
            const set = new Set(s.enabledLanguages || []);
            if (v) set.add(lang.id); else set.delete(lang.id);
            s.enabledLanguages = [...set];
            await this.plugin.saveSettings();
            this.plugin.refreshActiveLanguages();
            this.plugin.rebuildIndex();
            this.plugin.rerenderViews();
            this.display();
          }));
        row.settingEl.addClass('glossary-lang-row');
      }
      for (const bad of errors) {
        const row = new Setting(containerEl)
          .setName(bad.file)
          .setDesc(`Invalid module: ${bad.error}`)
          .addExtraButton((b) => b.setIcon('alert-triangle').setTooltip(`Invalid module: ${bad.error}`).setDisabled(true));
        row.nameEl.addClass('glossary-lang-error');
        row.settingEl.addClass('glossary-lang-row');
        row.settingEl.addClass('mod-warning');
      }
    }

    new Setting(containerEl)
      .setName('Link first occurrence only')
      .setDesc('When turning terms into links, link only the first occurrence of each term on a page and leave the rest as plain text. Off = link every occurrence.')
      .addToggle((t) => t.setValue(s.linkFirstOnly).onChange(async (v) => { s.linkFirstOnly = v; await save(false); }));

    new Setting(containerEl)
      .setName('Excluded terms')
      .setDesc('Term titles, one per line. These glossary terms are dropped from the index entirely — never highlighted or linked anywhere.')
      .addTextArea((t) => { t.setValue(s.excludeTerms).onChange(async (v) => { s.excludeTerms = v; await save(true); }); t.inputEl.rows = 3; });

    new Setting(containerEl)
      .setName('Excluded words')
      .setDesc('Surface words, one per line. These words (and their inflections) never trigger a link, even if they match a term — useful for homonyms (e.g. a common word "lead" that collides with a term "Lead").')
      .addTextArea((t) => { t.setValue(s.excludeWords).onChange(async (v) => { s.excludeWords = v; await save(true); }); t.inputEl.rows = 3; });

    // --- Highlighting ---
    containerEl.createEl('h3', { text: 'Highlighting' });

    new Setting(containerEl)
      .setName('Highlight in Reading view')
      .setDesc('In the fully-rendered Reading view, underline detected terms as clickable links (the note text on disk is not changed). They behave like real internal links: hover shows a page preview (per your Page Preview settings), click opens the note, right-click opens the actions menu.')
      .addToggle((t) => t.setValue(s.highlightInReading).onChange(async (v) => { s.highlightInReading = v; await save(false); this.plugin.rerenderViews(); }));

    new Setting(containerEl)
      .setName('Highlight while editing')
      .setDesc('Underline terms in the editor (Live Preview / Source view) too, not just in Reading view. "Live" updates as you type; "On save" updates a moment after you stop typing (less flicker); "Off" leaves the editor unhighlighted. Takes effect immediately, no reload needed.')
      .addDropdown((d) => d
        .addOption('off', 'Off')
        .addOption('live', 'Live (as you type)')
        .addOption('onSave', 'On save')
        .setValue(s.editingHighlight)
        .onChange(async (v) => { s.editingHighlight = v; await save(false); this.plugin.refreshEditors(); }));

    new Setting(containerEl)
      .setName('Skip headings')
      .setDesc('Do not highlight or turn into links any terms that appear inside Markdown headings (lines starting with #). On = headings are left untouched.')
      .addToggle((t) => t.setValue(s.skipHeadings).onChange(async (v) => { s.skipHeadings = v; await save(false); this.plugin.rerenderViews(); }));

    // --- Collecting aliases ---
    containerEl.createEl('h3', { text: 'Collecting aliases' });
    containerEl.createEl('div', { cls: 'glossary-section-desc', text: 'Reads the links you already made by hand, like [[Term|some wording]], and adds that wording to the term\'s aliases — so the same wording links automatically next time.' });

    new Setting(containerEl)
      .setName('Alias form')
      .setDesc('How the link text is stored as an alias. "Base form" reduces it to a dictionary form first, so one alias covers many word forms (link text "boxes" is stored as "box"). "As written" stores the exact text ("boxes"). "Both" stores both.')
      .addDropdown((d) => d
        .addOption('lemma', 'Base form')
        .addOption('literal', 'As written')
        .addOption('both', 'Both')
        .setValue(s.aliasHarvestMode)
        .onChange(async (v) => { s.aliasHarvestMode = v; await save(false); }));

    new Setting(containerEl)
      .setName('Collect on save')
      .setDesc('Collect aliases automatically when a note is saved (with a short delay). "Silent" adds new aliases without asking; "Ask first" shows a preview to confirm; "Off" = only via the commands.')
      .addDropdown((d) => d
        .addOption('off', 'Off')
        .addOption('silent', 'Silent (add automatically)')
        .addOption('preview', 'Ask first')
        .setValue(s.harvestOnSave)
        .onChange(async (v) => { s.harvestOnSave = v; await save(false); }));

    new Setting(containerEl)
      .setName('Single-word aliases only')
      .setDesc('Only collect link texts that are a single word. On = skip multi-word link text, which reduces to a base form poorly. Off = also collect multi-word texts as written.')
      .addToggle((t) => t.setValue(s.harvestSingleWordOnly).onChange(async (v) => { s.harvestSingleWordOnly = v; await save(false); }));

    new Setting(containerEl)
      .setName('Minimum alias length')
      .setDesc('Ignore collected aliases shorter than this many characters (avoids noise from 1–2 letter fragments).')
      .addText((t) => { t.inputEl.type = 'number'; t.inputEl.min = '1'; t.setValue(String(s.harvestMinLength)).onChange(async (v) => { const n = parseInt(v, 10); s.harvestMinLength = Number.isFinite(n) && n > 0 ? n : 1; await save(false); }); });

    // --- Maintenance ---
    containerEl.createEl('h3', { text: 'Maintenance' });

    new Setting(containerEl)
      .setName('Rebuild glossary index')
      .setDesc('Re-scan the glossary folder now. The index also rebuilds automatically when glossary notes change.')
      .addButton((b) => b.setButtonText('Rebuild').onClick(() => { this.plugin.rebuildIndex(); new Notice('Glossary Linker: index rebuilt'); }));
  }
}

module.exports = { GlossaryLinkerSettingTab };
