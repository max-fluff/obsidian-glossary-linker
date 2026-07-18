'use strict';

// Entry point for `npm test`: load every *.test.js in this folder, then run them.

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { run } = require('./harness');

// Plugin modules require `obsidian` (and CodeMirror) at load time, and neither exists
// outside the app. Point those requests at local stubs so a module can be loaded and its
// own logic exercised. Only the test process is affected; the bundle marks these external
// and Obsidian supplies the real ones at runtime.
//
// Installed here rather than by whichever test file happens to need it. `require` caches by
// resolved filename, so the first test file to pull in `obsidian` fixes the stub for every
// file after it — which made a suite pass or fail on the alphabetical order of its test
// files, and reported a missing stub class as if the plugin itself were broken.
require('./stubs/app').installStubs();

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();

if (!files.length) {
  console.error('No *.test.js files found in test/');
  process.exit(1);
}

for (const f of files) require(path.join(dir, f));

run();
