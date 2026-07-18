'use strict';

// The plugin must survive being constructed and loaded. esbuild happily bundles a call to a
// deleted helper, so "it builds" says nothing about whether onload runs — this runs it.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs, recordingMenu, fakeEditor, obsidianStub } = require('./stubs/app');

installStubs();

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  await plugin.onload();
  return plugin;
};

describe('onload', () => {
  it('constructs and loads without throwing', async () => {
    const plugin = await load();
    assert.ok(plugin, 'no plugin instance');
  });

  it('publishes the linker provider a sibling can find', async () => {
    const plugin = await load();
    const provider = plugin.api && plugin.api.linker;
    assert.ok(provider, 'api.linker missing — siblings would not see us at all');
    assert.strictEqual(provider.id, 'glossary-linker');
    assert.strictEqual(typeof provider.matches, 'function');
    assert.strictEqual(typeof provider.open, 'function');
    assert.strictEqual(typeof provider.precedence, 'number');
  });

  it('registers the editor highlight without throwing', async () => {
    const plugin = await load();
    plugin.registerEditingHighlight();
  });

  it('builds editor decorations over plain text', async () => {
    const plugin = await load();
    assert.deepStrictEqual(plugin.ownSpans('a spawn here', []), []);
    assert.deepStrictEqual(plugin.yieldedIn('a spawn here'), []);
  });

  it('builds the editor menu without throwing', async () => {
    // The handler itself, not just the registration — nothing else in the suite runs it.
    const plugin = await load();
    const handler = fakeApp.handlers.get('editor-menu');
    assert.ok(handler, 'no editor-menu handler was registered');
    const menu = recordingMenu();
    handler(menu, fakeEditor('nothing here matches anything', 3));
    assert.ok(Array.isArray(menu.titles()));
  });
  it('offers alias collection on a note, flat and named for what it collects', async () => {
    const plugin = await load();
    const handler = fakeApp.handlers.get('file-menu');
    assert.ok(handler, 'no file-menu handler was registered');
    const menu = recordingMenu();
    const note = Object.assign(new obsidianStub.TFile(), { path: 'Note.md', extension: 'md', basename: 'Note' });
    handler(menu, note, 'file-explorer');
    assert.deepStrictEqual(menu.groups(), [], 'wrapped the note actions in a submenu again');
    assert.ok(menu.titles().includes('Collect glossary aliases from links'));
  });
});
