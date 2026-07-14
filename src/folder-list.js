'use strict';

const { Setting, setIcon } = require('obsidian');

// A folder-set editor. The header row carries the name and description; each chosen
// path is a compact indented row below it with a remove button; a full-width input
// with autocomplete and an add button sits at the bottom. Storage stays a "\n"-joined
// string (splitLines reads it unchanged), so this is a pure UI swap — no migration.
// Callers pass their own CSS prefix, labels and suggest source.
function renderFolderList(containerEl, opts) {
  const cls = opts.cls;
  const norm = opts.normalize || ((x) => x.trim());
  const read = () => (opts.get() || '').split('\n').map((x) => x.trim()).filter(Boolean);

  new Setting(containerEl).setName(opts.name).setDesc(opts.desc);
  const rowsEl = containerEl.createDiv({ cls: `${cls}-folder-rows` });
  const addEl = containerEl.createDiv({ cls: `${cls}-folder-add` });

  const commit = async (next) => {
    const seen = new Set();
    const clean = [];
    for (const p of next) {
      const n = norm(p);
      if (n && !seen.has(n)) { seen.add(n); clean.push(n); }
    }
    await opts.set(clean.join('\n'));
    draw();
  };

  const draw = () => {
    rowsEl.empty();
    read().forEach((path, i) => {
      const row = new Setting(rowsEl).setName(path);
      row.settingEl.addClass(`${cls}-folder-row`);
      row.addExtraButton((b) => b.setIcon('x').setTooltip(opts.removeLabel || '')
        .onClick(() => { const next = read(); next.splice(i, 1); commit(next); }));
    });
  };

  const input = addEl.createEl('input', { type: 'text', cls: `${cls}-folder-input`, attr: { placeholder: opts.placeholder || '' } });
  const addBtn = addEl.createEl('button', { cls: `${cls}-folder-addbtn`, attr: { 'aria-label': opts.addLabel || '' } });
  setIcon(addBtn, 'plus');

  const add = (raw) => {
    // A blank entry just clears the box; the suggest may already have added and
    // emptied it, so a trailing Enter is a harmless no-op.
    if (norm(raw)) commit([...read(), raw]);
    input.value = '';
    input.focus();
  };

  if (opts.attachSuggest) opts.attachSuggest(input, add);
  addBtn.addEventListener('click', () => add(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(input.value); } });

  draw();
}

module.exports = { renderFolderList };
