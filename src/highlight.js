'use strict';

const { createHighlight } = require('./shared/prose/highlight');

// Highlighting in Reading view (DOM) and in the editor (CM6). Mixed into the plugin
// prototype. The behaviour is shared with the heading linker; only the names differ.
module.exports = createHighlight({
  // A global namespace: `glossary-link`, `cm-glossary-link`, `data-glossary-target`.
  cls: 'glossary',
  displayName: 'Glossary Linker',
  // What a term match links to: the term's canonical title.
  targetOf: (m) => m.canonical,
  // A term's own note does not link to itself, so the matcher needs to know which file it
  // is reading.
  selfIdFor: (plugin, sourcePath) => plugin.canonicalForPath(sourcePath),
});
