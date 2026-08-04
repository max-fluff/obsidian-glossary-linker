'use strict';

const { t } = require('./shared/i18n');

// The explorer menu's path toggles, declared once for both surfaces (shared/actions.js).
// A folder has no extension; a note that is not markdown is not ours to list.
function pathContext(file) {
  if (!file || !file.path) return null;
  const isFolder = file.extension === undefined;
  if (!isFolder && file.extension !== 'md') return null;
  return { path: file.path, noun: t(isFolder ? 'noun.folder' : 'noun.file') };
}

// `add` is both the effect and the condition: the add twin appears only while the path is
// absent from the list, the remove twin only while it is there.
const pathAction = ({ id, name, titleKey, icon, listKey, add, when }) => ({
  id,
  name,
  surface: 'file',
  icon,
  title: (ctx) => t(titleKey, { noun: ctx.noun }),
  resolve: (plugin, file) => {
    const ctx = pathContext(file);
    if (!ctx || (when && !when(plugin))) return null;
    return plugin.pathListed(listKey, ctx.path) === add ? null : ctx;
  },
  run: (plugin, ctx) => plugin.setPathInList(listKey, ctx.path, add),
});

const folderScope = (plugin) => plugin.settings.scopeMode === 'folders';

const PATH_ACTIONS = [
  pathAction({ id: 'exclude-note', name: 'cmd.excludeNote', titleKey: 'menu.addToAlwaysExcluded', icon: 'ban', listKey: 'excludeFolders', add: true }),
  pathAction({ id: 'unexclude-note', name: 'cmd.unexcludeNote', titleKey: 'menu.removeFromAlwaysExcluded', icon: 'rotate-ccw', listKey: 'excludeFolders', add: false }),
  pathAction({ id: 'scope-note', name: 'cmd.scopeNote', titleKey: 'menu.includeInScope', icon: 'folder-plus', listKey: 'scopeFolders', add: true, when: folderScope }),
  pathAction({ id: 'unscope-note', name: 'cmd.unscopeNote', titleKey: 'menu.removeFromScope', icon: 'folder-minus', listKey: 'scopeFolders', add: false, when: folderScope }),
];

module.exports = { PATH_ACTIONS };
