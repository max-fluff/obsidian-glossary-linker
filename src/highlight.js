'use strict';

const { createHighlight } = require('./shared/prose/highlight');

// Highlighting in Reading view (DOM) and in the editor (CM6). Mixed into the plugin
// prototype; the behaviour is shared with the heading linker, only the names differ.
module.exports = createHighlight({
  cls: 'glossary',
  displayName: 'Glossary Linker',
  targetOf: (m) => m.canonical,
  selfIdFor: (plugin, sourcePath) => plugin.canonicalForPath(sourcePath),
});
