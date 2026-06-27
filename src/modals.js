'use strict';

const { Modal } = require('obsidian');

class MaterializePreviewModal extends Modal {
  constructor(app, fileChanges, onApply) {
    super(app);
    this.fileChanges = fileChanges;
    this.onApply = onApply;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Turn terms into links — preview' });
    const total = this.fileChanges.reduce((n, f) => n + f.changes.length, 0);
    contentEl.createEl('p', { text: `Files: ${this.fileChanges.length}, replacements: ${total}` });

    for (const fc of this.fileChanges) {
      contentEl.createDiv({ cls: 'glossary-preview-file', text: fc.file ? fc.file.path : (fc.label || 'selection') });
      const table = contentEl.createEl('table', { cls: 'glossary-preview-table' });
      for (const c of fc.changes.slice(0, 50)) {
        const tr = table.createEl('tr');
        tr.createEl('td', { text: c.before });
        tr.createEl('td', { text: '→' });
        tr.createEl('td', { text: c.after });
      }
      if (fc.changes.length > 50) contentEl.createEl('div', { cls: 'glossary-preview-empty', text: `…and ${fc.changes.length - 50} more` });
    }

    const buttons = contentEl.createDiv({ cls: 'glossary-preview-buttons' });
    const apply = buttons.createEl('button', { text: 'Apply', cls: 'mod-cta' });
    apply.onclick = async () => { await this.onApply(this.fileChanges); this.close(); };
    buttons.createEl('button', { text: 'Cancel' }).onclick = () => this.close();
  }

  onClose() { this.contentEl.empty(); }
}

class HarvestPreviewModal extends Modal {
  constructor(app, additions, onApply) {
    super(app);
    this.additions = additions;
    this.onApply = onApply;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl('h3', { text: 'Collect aliases — preview' });
    const total = this.additions.reduce((n, a) => n + a.aliases.length, 0);
    contentEl.createEl('p', { text: `Terms: ${this.additions.length}, new aliases: ${total}` });

    const table = contentEl.createEl('table', { cls: 'glossary-preview-table' });
    const head = table.createEl('tr');
    head.createEl('th', { text: 'Term' });
    head.createEl('th', { text: 'Aliases to add' });
    for (const a of this.additions) {
      const tr = table.createEl('tr');
      tr.createEl('td', { text: a.file.basename });
      const td = tr.createEl('td');
      a.aliases.forEach((al, i) => {
        if (i) td.appendText(', ');
        td.createSpan({ cls: 'glossary-add', text: al });
      });
    }

    const buttons = contentEl.createDiv({ cls: 'glossary-preview-buttons' });
    const apply = buttons.createEl('button', { text: 'Write', cls: 'mod-cta' });
    apply.onclick = async () => { await this.onApply(this.additions); this.close(); };
    buttons.createEl('button', { text: 'Cancel' }).onclick = () => this.close();
  }

  onClose() { this.contentEl.empty(); }
}

module.exports = { MaterializePreviewModal, HarvestPreviewModal };
