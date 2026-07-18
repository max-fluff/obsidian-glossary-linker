'use strict';

// Entry point for `npm test`: load every *.test.js here and in the shared submodule's
// testing/tests, then run them.

const fs = require('fs');
const path = require('path');
const { run } = require('../src/shared/testing/harness');

// Plugin modules require `obsidian` and CodeMirror at load time, and neither exists outside
// the app. Installed here, not by whichever test file happens to need it: `require` caches
// by resolved filename, so the first file to pull in `obsidian` fixes the stub for every
// file after it.
require('./stubs/app').installStubs();

const dirs = [__dirname, path.join(__dirname, '..', 'src', 'shared', 'testing', 'tests')];
const files = [];
for (const dir of dirs) {
  for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.test.js')).sort()) files.push(path.join(dir, f));
}
if (!files.length) {
  console.error('No *.test.js files found');
  process.exit(1);
}

for (const f of files) require(f);

run();
