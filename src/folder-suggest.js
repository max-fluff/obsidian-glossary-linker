'use strict';

// Folder and file autocomplete for the settings inputs, shared with the heading linker.
// It suggests folders inside the vault, so it is the prose pair's variant — the sigil
// linkers point at roots outside the vault and use shared/deeplink/folder-suggest.js
// instead, which walks the real filesystem.
module.exports = require('./shared/prose/folder-suggest');
