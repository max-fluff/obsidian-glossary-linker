'use strict';

const obsidian = require('obsidian');
const { AbstractInputSuggest, TFolder } = obsidian;

// Folder autocomplete for a single-line text input. AbstractInputSuggest landed
// after the plugin's minAppVersion, so callers feature-detect before using this.
class FolderSuggest extends AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.app.vault.getAllLoadedFiles()
      .filter((f) => f instanceof TFolder && f.path.toLowerCase().includes(q));
  }

  renderSuggestion(folder, el) {
    el.setText(folder.path || '/');
  }

  selectSuggestion(folder) {
    this.setValue(folder.path);
    this.inputEl.trigger('input');
    this.close();
  }
}

class FileSuggest extends AbstractInputSuggest {
  constructor(app, inputEl) {
    super(app, inputEl);
    this.inputEl = inputEl;
  }

  getSuggestions(query) {
    const q = query.toLowerCase();
    return this.app.vault.getMarkdownFiles()
      .filter((f) => f.path.toLowerCase().includes(q))
      .slice(0, 50);
  }

  renderSuggestion(file, el) {
    el.setText(file.path);
  }

  selectSuggestion(file) {
    this.setValue(file.path);
    this.inputEl.trigger('input');
    this.close();
  }
}

// Folder-or-file autocomplete for the include/exclude path lists, which accept
// either. Folders rank first. onSelect, when given, receives the picked path and
// clears the box instead of writing it back — the folder-list editor adds it as a
// row rather than binding the input to one value.
class PathSuggest extends AbstractInputSuggest {
  constructor(app, inputEl, onSelect) {
    super(app, inputEl);
    this.inputEl = inputEl;
    this.onSelect = onSelect;
  }

  getSuggestions(query) {
    const q = query.toLowerCase();
    const isFolder = (f) => f instanceof TFolder;
    return this.app.vault.getAllLoadedFiles()
      .filter((f) => f.path && f.path.toLowerCase().includes(q))
      .sort((a, b) => (isFolder(a) === isFolder(b) ? a.path.localeCompare(b.path) : isFolder(a) ? -1 : 1))
      .slice(0, 50);
  }

  renderSuggestion(f, el) {
    el.setText(f.path || '/');
  }

  selectSuggestion(f) {
    if (this.onSelect) { this.onSelect(f.path); this.setValue(''); this.close(); return; }
    this.setValue(f.path);
    this.inputEl.trigger('input');
    this.close();
  }
}

const folderSuggestAvailable = () => typeof AbstractInputSuggest === 'function';

module.exports = { FolderSuggest, FileSuggest, PathSuggest, folderSuggestAvailable };
