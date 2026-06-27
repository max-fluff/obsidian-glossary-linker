'use strict';

// Built-in language modules, bundled into main.js so the plugin works as soon as
// it is installed (the community installer only ships main.js / manifest / styles,
// not the languages/ folder). Users can still drop extra or override modules into
// the vault's <plugin>/languages/ folder — those are loaded at runtime on top of
// these. These are the same files that live in languages/.

module.exports = [
  require('../languages/ru.js'),
  require('../languages/en.js'),
  require('../languages/es.js'),
  require('../languages/de.js'),
  require('../languages/fr.js'),
];
