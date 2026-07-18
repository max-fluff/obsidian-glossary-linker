'use strict';

// Minimal zero-dependency test runner, shared by the linker plugins.
//
// Node's own `node:test` would do this job, but the toolchain still runs on Node 16 where
// it doesn't exist. The API here is deliberately the describe/it subset of `node:test`,
// and assertions are plain `node:assert`, so switching over later is a change of imports
// and nothing else.
//
// Once the shared submodule is the single home for family-wide code, this file moves there
// and each plugin requires it instead of carrying a copy.

const assert = require('assert');

const suites = [];
let current = null;

function describe(name, fn) {
  const previous = current;
  current = { name, tests: [] };
  suites.push(current);
  fn();
  current = previous;
}

function it(name, fn) {
  if (!current) throw new Error(`it(${JSON.stringify(name)}) called outside describe()`);
  current.tests.push({ name, fn });
}

async function run() {
  let passed = 0;
  const failures = [];

  for (const suite of suites) {
    console.log(`\n${suite.name}`);
    for (const test of suite.tests) {
      try {
        await test.fn();
        passed++;
        console.log(`  ok    ${test.name}`);
      } catch (err) {
        failures.push({ suite: suite.name, test: test.name, err });
        console.log(`  FAIL  ${test.name}`);
      }
    }
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    for (const f of failures) {
      console.log(`\n--- ${f.suite} > ${f.test} ---`);
      console.log(f.err && f.err.stack ? f.err.stack : String(f.err));
    }
    process.exitCode = 1;
  }
}

module.exports = { describe, it, assert, run };
