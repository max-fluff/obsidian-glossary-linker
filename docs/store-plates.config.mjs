// Store-plate config for Glossary Linker. Run: npm run plates
// See src/shared/branding/BRANDING.md for the full field reference.

// The plugin's mark: a white bar with a dashed underline (a highlighted term).
const MARK_SVG = `<svg class="mark-glyph" viewBox="100 189 312 134" xmlns="http://www.w3.org/2000/svg">
  <rect x="110" y="199" width="292" height="60" fill="#fff"/>
  <line x1="120" y1="303" x2="392" y2="303" stroke="#fff" stroke-width="20" stroke-linecap="round" stroke-dasharray="1 37.85"/>
</svg>`;

export default {
  imagesDir: 'docs/images',
  outDir: 'docs/images/store',

  brand: {
    gradient: ['#27243d', '#191826'],
    accent: '#a68cff',
    tokenColor: '#b6a6e8',
    tokenMono: false,
    // "word" in two forms across the plugin's languages (en, es, de, fr, ru, uk).
    tokens: [
      'palabras', 'Wörter', 'words', 'Wort', 'mots', 'слова', 'word',
      'mot', 'palabra', 'слів', 'словами', 'слово', 'palabra', 'Wörter',
    ],
    mark: { kind: 'svg', svg: MARK_SVG },
    wordmark: { text: 'Glossary Linker', underline: 'Glossary' },
  },

  plates: [
    { src: 'hero.png',              title: 'Terms link themselves',
      caption: 'Every glossary term is highlighted as a link — in any word form, in any language.' },
    { src: 'turn-into-links.png',   title: 'Turn terms into links',
      caption: 'Preview every replacement before a single word is written to your notes.' },
    { src: 'quick-capture.png',     title: 'Link as you type',
      caption: 'Start typing a term and pick it from the suggestion list — aliases included.' },
    { src: 'collect-aliases-2.png', title: 'Learn new aliases',
      caption: 'Collect aliases from links you already made, with collisions flagged.' },
    { src: 'overview.png',          title: 'See your whole glossary',
      caption: 'Usage counts, unused terms, and frequent words not yet defined.' },
  ],
};
