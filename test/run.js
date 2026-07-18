'use strict';

// Entry point for `npm test`: load every *.test.js in this folder, then run them.

const fs = require('fs');
const path = require('path');
const { run } = require('./harness');

const dir = __dirname;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort();

if (!files.length) {
  console.error('No *.test.js files found in test/');
  process.exit(1);
}

for (const f of files) require(path.join(dir, f));

run();
