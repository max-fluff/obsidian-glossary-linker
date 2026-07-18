'use strict';

// The plugin must survive being constructed and loaded.
//
// This exists because it didn't: a helper was deleted while a call to it stayed behind, and
// the plugin threw in onload and refused to load at all. esbuild bundles an undefined
// identifier happily, and no other test reaches registerEditingHighlight — so "it builds and
// the tests pass" said nothing about whether the plugin runs. This runs it.

const { describe, it, assert } = require('./harness');
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
    // Where the regression actually was: called from onload, and reached by nothing else.
    const plugin = await load();
    plugin.registerEditingHighlight();
  });

  it('builds editor decorations over plain text', async () => {
    const plugin = await load();
    assert.deepStrictEqual(plugin.ownSpans('a spawn here', []), []);
    assert.deepStrictEqual(plugin.yieldedIn('a spawn here'), []);
  });

  it('builds the editor menu without throwing', async () => {
    // The handler itself, not just the registration. Everything the reader sees in the
    // right-click menu is built in here, and nothing else in the suite runs a line of it —
    // which is how a call to a deleted helper survived a green test run once already.
    const plugin = await load();
    const handler = fakeApp.handlers.get('editor-menu');
    assert.ok(handler, 'no editor-menu handler was registered');
    const menu = recordingMenu();
    handler(menu, fakeEditor('nothing here matches anything', 3));
    assert.ok(Array.isArray(menu.titles()));
  });
  it('offers alias collection on a note, flat and named for what it collects', async () => {
    // Harvesting moved here from the editor menu, where it had nothing to do with what was
    // under the cursor and both prose linkers offered it at once.
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
