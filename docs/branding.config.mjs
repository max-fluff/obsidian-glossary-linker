// Branding config for Glossary Linker — drives both the store plates and the vector
// headers. Run: npm run plates / npm run banner
// See src/shared/branding/BRANDING.md for the full field reference.

// The plugin's mark: "Aa" over a dashed underline — one term in two word forms.
// Coordinates live in the icon's 512 space; the viewBox crops to the mark's bounds.
// The dash step is (line length - 1) / (dots - 1), so the end dots land on the ends.
const MARK = {
  kind: 'svg',
  viewBox: '95 148 322 232',
  body: `<text x="256" y="307" fill="#fff" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="230" letter-spacing="-6" text-anchor="middle">Aa</text>
  <line x1="106" y1="369" x2="406" y2="369" stroke="#fff" stroke-width="21" stroke-linecap="round" stroke-dasharray="1 41.71"/>`,
};

export default {
  imagesDir: 'docs/images',
  outDir: 'docs/images/store',

  brand: {
    gradient: ['#27243d', '#191826'],
    tokenColor: '#b6a6e8',
    tokenMono: false,
    // "word" in two forms across the plugin's languages (en, es, de, fr, ru, uk).
    tokens: [
      'palabras', 'Wörter', 'words', 'Wort', 'mots', 'слова', 'word',
      'mot', 'palabra', 'слів', 'словами', 'слово', 'palabra', 'Wörter',
    ],
    mark: MARK,
    wordmark: { text: 'Glossary Linker' },
    tagline: 'Highlight terms in any word form, then link them.',
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
