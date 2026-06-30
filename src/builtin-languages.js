'use strict';

// The bundled language modules. Requiring them here pulls each into main.js at
// build time. To add a language, drop a module in languages/ and list it here
// (see languages/README.md), then rebuild.

const BUILTIN_LANGUAGES = [
  require('../languages/ru.js'),
  require('../languages/uk.js'),
  require('../languages/en.js'),
  require('../languages/es.js'),
  require('../languages/de.js'),
  require('../languages/fr.js'),
];

module.exports = { BUILTIN_LANGUAGES };
