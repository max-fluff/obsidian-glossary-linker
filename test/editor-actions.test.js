'use strict';

// The editor menu and the command palette are written from one list (src/editor-actions.js).
// This fires both in each situation the cursor can be in and compares them action by action,
// so an item can never again reach one surface and be missing from the other.

const { describe, it, assert } = require('../src/shared/testing/harness');
const path = require('path');
const { fakeApp, installStubs, recordingMenu, fakeEditor } = require('../src/shared/testing/stubs');

installStubs();

const { EDITOR_ACTIONS } = require(path.join(__dirname, '..', 'src', 'editor-actions.js'));

const load = async () => {
  const Plugin = require(path.join(__dirname, '..', 'src', 'main.js'));
  const plugin = new Plugin(fakeApp, { version: '0.0.0', id: 'glossary-linker' });
  const commands = [];
  plugin.addCommand = (c) => commands.push(c);
  await plugin.onload();
  plugin.inScope = () => true;
  fakeApp.workspace.getActiveFile = () => ({ path: 'Note.md', basename: 'Note', extension: 'md' });
  return { plugin, commands };
};

const hit = { line: 0, match: { start: 0, end: 5, display: 'spawn', alts: [], canonical: 'Spawn' }, foreign: [] };
const link = { canonical: 'Spawn', display: 'spawning', targetFile: { basename: 'Spawn' }, line: 0, from: 0, to: 9 };

const compare = async (situation) => {
  const { plugin, commands } = await load();
  const editor = fakeEditor('spawn here', 2);
  editor.getSelection = () => '';
  situation(plugin);

  const menu = recordingMenu();
  fakeApp.handlers.get('editor-menu')(menu, editor);
  const titles = menu.titles();

  for (const action of EDITOR_ACTIONS) {
    const ctx = action.resolve(plugin, editor);
    const command = commands.find((c) => c.id === action.id);
    assert.ok(command, `no command for ${action.id}`);
    assert.strictEqual(
      command.editorCheckCallback(true, editor),
      !!ctx,
      `${action.id}: the palette disagrees with the action`
    );
    // A menu setting can hide the item; the command stays either way.
    if (!ctx || (action.inMenu && !action.inMenu(plugin))) continue;
    // Whether an item ends up in a group is the builder's call — it depends on what else
    // resolved here — so either wording counts, as long as the item is there.
    const wordings = [action.title(ctx, false), action.title(ctx, true)];
    assert.ok(
      titles.some((x) => wordings.some((w) => x === w || x.endsWith(`▸ ${w}`))),
      `${action.id}: the menu is missing "${wordings[0]}" — ${JSON.stringify(titles)}`
    );
  }
};

describe('editor actions', () => {
  it('agrees on a word the plugin matches', async () => {
    await compare((plugin) => {
      plugin.glossaryLinkAt = () => null;
      plugin.matchAtCursor = () => hit;
      plugin.wordAtCursor = () => null;
    });
  });

  it('agrees on one of our links', async () => {
    await compare((plugin) => {
      plugin.glossaryLinkAt = () => link;
      plugin.matchAtCursor = () => null;
    });
  });

  it('agrees on a word that is already excluded', async () => {
    await compare((plugin) => {
      plugin.glossaryLinkAt = () => null;
      plugin.matchAtCursor = () => null;
      plugin.wordAtCursor = () => null;
      plugin.rawWordAtCursor = () => 'spawn';
      plugin.settings.excludeWords = 'spawn';
    });
  });

  it('agrees where the plugin has nothing to offer', async () => {
    await compare((plugin) => {
      plugin.glossaryLinkAt = () => null;
      plugin.matchAtCursor = () => null;
      plugin.wordAtCursor = () => null;
      plugin.rawWordAtCursor = () => null;
    });
  });
});
