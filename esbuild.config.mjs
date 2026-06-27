import esbuild from 'esbuild';

const banner = '/* Glossary Linker — bundled from src/ by esbuild. Do not edit directly; edit src/ and run "npm run build". */';

esbuild.build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2018',
  outfile: 'main.js',
  banner: { js: banner },
  external: [
    'obsidian', 'electron',
    '@codemirror/state', '@codemirror/view', '@codemirror/language',
    '@lezer/common', '@lezer/highlight', '@lezer/lr',
  ],
  logLevel: 'info',
}).catch((e) => { console.error(e); process.exit(1); });
