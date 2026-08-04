'use strict';

// The explorer menu and the command palette are written from one list (src/path-actions.js).
// This fires both against the same note and compares them action by action, so a path toggle
// can never again reach one surface and be missing from the other.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs, obsidianStub, recordingMenu } = require('../src/shared/testing/stubs');

installStubs();

const { PATH_ACTIONS } = require(path.join(__dirname, '..', 'src', 'path-actions.js'));

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  const commands = [];
  plugin.addCommand = (c) => commands.push(c);
  await plugin.onload();
  return { plugin, commands };
};

const note = () => Object.assign(new obsidianStub.TFile(), { path: 'Notes/A.md', extension: 'md', basename: 'A' });

describe('path actions', () => {
  const compare = async (settings) => {
    const { plugin, commands } = await load();
    Object.assign(plugin.settings, settings);
    const file = note();
    fakeApp.workspace.getActiveFile = () => file;

    const menu = recordingMenu();
    fakeApp.handlers.get('file-menu')(menu, file, 'file-explorer');
    const titles = menu.titles();

    for (const action of PATH_ACTIONS) {
      const ctx = action.resolve(plugin, file);
      const command = commands.find((c) => c.id === action.id);
      assert.ok(command, `no command for ${action.id}`);
      assert.strictEqual(
        command.checkCallback(true),
        !!ctx,
        `${action.id}: the palette disagrees with the action`
      );
      assert.strictEqual(
        ctx ? titles.includes(action.title(ctx)) : !titles.some((x) => x === action.title({ path: file.path, noun: 'file' })),
        true,
        `${action.id}: the menu disagrees with the action`
      );
    }
  };

  it('agrees on a note that is on no list', async () => {
    await compare({ scopeMode: 'vault', excludeFolders: '', scopeFolders: '' });
  });

  it('agrees once the note is always-excluded and scoping is on', async () => {
    await compare({ scopeMode: 'folders', excludeFolders: 'Notes/A.md', scopeFolders: '' });
  });
});
