/* Glossary Linker 1.3.1 — bundled from src/ by esbuild. Do not edit directly; edit src/ and run "npm run build". */
"use strict";
var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};

// src/constants.js
var require_constants = __commonJS({
  "src/constants.js"(exports2, module2) {
    "use strict";
    var DEFAULT_SETTINGS2 = {
      glossaryFolder: "glossary",
      termTemplate: "",
      // path to a template note; empty = create an empty note (as before)
      scopeMode: "vault",
      // 'folders' | 'vault'
      scopeFolders: "",
      excludeFolders: "",
      matchMode: "stemmer",
      // 'stemmer' | 'endingStrip' | 'exact'
      minTermLength: 2,
      // forms (title/alias) shorter than this are not indexed — keeps single letters from matching everywhere
      enabledLanguages: null,
      // null until first-run defaults are picked
      languageOrder: [],
      // ids in priority order (first = highest); overrides module defaults
      aliasHarvestMode: "lemma",
      // 'lemma' | 'literal' | 'both'
      harvestOnSave: "off",
      // 'off' | 'silent' | 'preview'
      harvestSingleWordOnly: true,
      harvestMinLength: 2,
      excludeTerms: "",
      excludeWords: "",
      linkFirstOnly: false,
      // Who wins a word both linkers match. Read by the other side through the api, so both
      // reach the same verdict; a whole note is broader than a heading anchor, hence lower.
      linkPrecedence: 10,
      linkSuggest: false,
      // offer [[link]] autocomplete while typing
      suggestMinChars: 3,
      // min typed length before autocomplete triggers
      suggestSkipAfter: "@#$^",
      // yield when the word follows one of these sigils (code-linker @@, tags, math, block refs)
      aliasCollisionWarnings: true,
      // warn when a collected/created alias collides with another term
      candidateMinNotes: 3,
      // overview: a candidate must appear in at least this many notes
      overviewSort: "usage",
      // overview terms order: 'usage' | 'name'
      overviewCandidateSort: "notes",
      // overview candidates order: 'notes' | 'count'
      overviewCountLinks: true,
      // overview usage count also counts direct [[Term]] links
      overviewWholeVault: false,
      // overview scans every note instead of the linker scope
      overviewTermsCollapsed: false,
      overviewCandidatesCollapsed: false,
      showRibbonIcon: true,
      highlightInReading: true,
      editingHighlight: "live",
      // 'off' | 'live' | 'onSave'
      skipHeadings: true,
      statusBar: true,
      statusBarIncludeLinks: true,
      menuTurnInto: true,
      menuCollect: true,
      menuOpen: true,
      menuCreateTerm: true,
      menuAddAlias: true,
      menuExclude: true,
      menuUnlink: true
    };
    var sanitizeFolder2 = (s) => (s || "").split("/").map((x) => x.trim()).filter((x) => x && x !== "." && x !== "..").join("/");
    module2.exports = { DEFAULT_SETTINGS: DEFAULT_SETTINGS2, sanitizeFolder: sanitizeFolder2 };
  }
});

// src/shared/markdown.js
var require_markdown = __commonJS({
  "src/shared/markdown.js"(exports2, module2) {
    "use strict";
    var splitLines2 = (s) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
    var LINK_PATTERN = "\\[([^\\]]*)\\]\\(([^)]+)\\)";
    var linkRegex = () => new RegExp(LINK_PATTERN, "g");
    var LINK_TITLE = /^([\s\S]*?)\s+(?:"([^"]*)"|'([^']*)')$/;
    function splitTarget(raw) {
      const s = String(raw == null ? "" : raw).trim();
      const m = LINK_TITLE.exec(s);
      if (!m)
        return { url: s, title: "" };
      return { url: m[1].trim(), title: m[2] != null ? m[2] : m[3] };
    }
    var withTitle = (url, title) => title ? url + ' "' + title + '"' : url;
    var isFenceLine = (line) => {
      const s = line.trimStart();
      return s.startsWith("```") || s.startsWith("~~~");
    };
    var INLINE_CODE = /`[^`\n]+`/g;
    function inMatch(line, col, re) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line)) !== null) {
        if (col > m.index && col < m.index + m[0].length)
          return true;
      }
      return false;
    }
    var inInlineCode = (line, col) => inMatch(line, col, INLINE_CODE);
    function locate(lines, pos) {
      let start = 0, i = 0;
      for (; i < lines.length; i++) {
        if (pos <= start + lines[i].length)
          break;
        start += lines[i].length + 1;
      }
      return { i, col: pos - start, line: lines[i] || "" };
    }
    function inCode(text, pos) {
      if (/^---\r?\n/.test(text)) {
        const end = text.indexOf("\n---", 3);
        if (end !== -1 && pos <= end + 4)
          return true;
      }
      const lines = text.split("\n");
      const { i, col, line } = locate(lines, pos);
      let fenced = false;
      for (let k = 0; k < i; k++)
        if (isFenceLine(lines[k]))
          fenced = !fenced;
      if (fenced)
        return true;
      return inMatch(line, col, INLINE_CODE);
    }
    function inLink(text, pos) {
      const { col, line } = locate(text.split("\n"), pos);
      return inMatch(line, col, linkRegex());
    }
    function isProtected(text, pos) {
      return inCode(text, pos) || inLink(text, pos);
    }
    function inTableCell2(text, pos) {
      const lines = text.split("\n");
      const lineIdx = (text.slice(0, pos).match(/\n/g) || []).length;
      if (!lines[lineIdx] || !lines[lineIdx].includes("|"))
        return false;
      const isDelimiter = (l) => l.includes("|") && l.includes("-") && /^[\s|:-]+$/.test(l);
      let top = lineIdx, bot = lineIdx;
      while (top > 0 && lines[top - 1].trim() !== "")
        top--;
      while (bot < lines.length - 1 && lines[bot + 1].trim() !== "")
        bot++;
      for (let i = top; i <= bot; i++)
        if (isDelimiter(lines[i]))
          return true;
      return false;
    }
    function rewriteLinks(text, fn) {
      const lines = text.split("\n");
      let fenced = false, count = 0;
      for (let i = 0; i < lines.length; i++) {
        if (isFenceLine(lines[i])) {
          fenced = !fenced;
          continue;
        }
        if (fenced)
          continue;
        lines[i] = lines[i].replace(linkRegex(), (whole, name, target, offset) => {
          if (inInlineCode(lines[i], offset))
            return whole;
          const out = fn(name, target);
          if (out == null)
            return whole;
          count++;
          return out;
        });
      }
      return { text: lines.join("\n"), count };
    }
    function rewriteFences(text, lang, fn) {
      const lines = text.split("\n");
      let count = 0;
      for (let i = 0; i < lines.length; i++) {
        const open = new RegExp("^\\s*(`{3,}|~{3,})\\s*" + lang + "\\s*$").exec(lines[i]);
        if (!open)
          continue;
        const close = new RegExp("^\\s*" + open[1][0] + "{" + open[1].length + ",}\\s*$");
        let j = i + 1;
        while (j < lines.length && !close.test(lines[j]))
          j++;
        const body = lines.slice(i + 1, j);
        const out = fn(body);
        if (out) {
          lines.splice(i + 1, body.length, ...out);
          count++;
          j = i + 1 + out.length;
        }
        i = j;
      }
      return { text: lines.join("\n"), count };
    }
    module2.exports = { splitLines: splitLines2, linkRegex, splitTarget, withTitle, rewriteLinks, rewriteFences, isFenceLine, inInlineCode, locate, inCode, inLink, isProtected, inTableCell: inTableCell2 };
  }
});

// src/shared/morphology/languages/ru.js
var require_ru = __commonJS({
  "src/shared/morphology/languages/ru.js"(exports2, module2) {
    "use strict";
    var RVRE = /^(.*?[аеиоуыэюя])(.*)$/;
    var PERFECTIVEGROUND = /((ив|ивши|ившись|ыв|ывши|ывшись)|((?<=[ая])(в|вши|вшись)))$/;
    var REFLEXIVE = /(с[яь])$/;
    var ADJECTIVE = /(ее|ие|ые|ое|ими|ыми|ей|ий|ый|ой|ем|им|ым|ом|его|ого|ему|ому|их|ых|ую|юю|ая|яя|ою|ею)$/;
    var PARTICIPLE = /((ивш|ывш|ующ)|((?<=[ая])(ем|нн|вш|ющ|щ)))$/;
    var VERB = /((ила|ыла|ена|ейте|уйте|ите|или|ыли|ей|уй|ил|ыл|им|ым|ен|ило|ыло|ено|ят|ует|уют|ит|ыт|ены|ить|ыть|ишь|ую|ю)|((?<=[ая])(ла|на|ете|йте|ли|й|л|ем|н|ло|но|ет|ют|ны|ть|ешь|нно)))$/;
    var NOUN = /(а|ев|ов|ие|ье|е|иями|ями|ами|еи|ии|и|ией|ей|ой|ий|й|иям|ям|ием|ем|ам|ом|о|у|ах|иях|ях|ы|ь|ию|ью|ю|ия|ья|я)$/;
    var DERIVATIONAL = /[^аеиоуыэюя][аеиоуыэюя]+[^аеиоуыэюя]+[аеиоуыэюя].*(?:[^аеиоуыэюя]+[аеиоуыэюя]+[^аеиоуыэюя]+)?(ость?)$/;
    var DER = /ость?$/;
    var SUPERLATIVE = /(ейше|ейш)$/;
    var I = /и$/;
    var P = /ь$/;
    var NN = /нн$/;
    var ENDINGS = [
      "\u0438\u044F\u043C\u0438",
      "\u044F\u043C\u0438",
      "\u0430\u043C\u0438",
      "\u0430\u0445",
      "\u044F\u0445",
      "\u043E\u0432",
      "\u0435\u0432",
      "\u043E\u044E",
      "\u0435\u044E",
      "\u043E\u043C",
      "\u0435\u043C",
      "\u0430\u043C",
      "\u044F\u043C",
      "\u043E\u0433\u043E",
      "\u0435\u0433\u043E",
      "\u043E\u043C\u0443",
      "\u0435\u043C\u0443",
      "\u044B\u043C\u0438",
      "\u0438\u043C\u0438",
      "\u043E\u0439",
      "\u0435\u0439",
      "\u0438\u0439",
      "\u044B\u0439",
      "\u0443\u044E",
      "\u044E\u044E",
      "\u0430",
      "\u044F",
      "\u0443",
      "\u044E",
      "\u043E",
      "\u0435",
      "\u0438",
      "\u044B",
      "\u044C"
    ].sort((a, b) => b.length - a.length);
    var VOWELS = "\u0430\u0435\u0451\u0438\u043E\u0443\u044B\u044D\u044E\u044F";
    function stem(word) {
      word = word.toLowerCase().replace(/ё/g, "\u0435");
      const m = RVRE.exec(word);
      if (!m)
        return word;
      const pre = m[1];
      let rv = m[2];
      let temp = rv.replace(PERFECTIVEGROUND, "");
      if (temp === rv) {
        rv = rv.replace(REFLEXIVE, "");
        temp = rv.replace(ADJECTIVE, "");
        if (temp !== rv) {
          rv = temp.replace(PARTICIPLE, "");
        } else {
          temp = rv.replace(VERB, "");
          rv = temp === rv ? rv.replace(NOUN, "") : temp;
        }
      } else {
        rv = temp;
      }
      rv = rv.replace(I, "");
      if (DERIVATIONAL.test(rv))
        rv = rv.replace(DER, "");
      temp = rv.replace(P, "");
      if (temp === rv) {
        rv = rv.replace(SUPERLATIVE, "");
        rv = rv.replace(NN, "\u043D");
      } else {
        rv = temp;
      }
      return pre + rv;
    }
    function strip(word) {
      word = word.toLowerCase().replace(/ё/g, "\u0435");
      for (const e of ENDINGS) {
        if (word.length - e.length >= 3 && word.endsWith(e))
          return word.slice(0, -e.length);
      }
      return word;
    }
    function stemKeys(word) {
      const es = strip(word);
      const st = stem(word);
      if (st !== es && es.length - st.length <= 1)
        return [es, st];
      return [es];
    }
    function softStemNoun(word) {
      const w = word.toLowerCase().replace(/ё/g, "\u0435");
      if (w.length > 3 && w.endsWith("\u0435\u043C")) {
        const before = w[w.length - 3];
        if (VOWELS.includes(before))
          return w.slice(0, -2) + "\u0439";
      }
      return null;
    }
    function lemma(word) {
      return softStemNoun(word) || strip(word);
    }
    module2.exports = {
      id: "ru",
      name: "Russian",
      priority: 0,
      match: (word) => /[Ѐ-ӿ]/.test(word),
      keys(word, mode) {
        const w = word.toLowerCase();
        if (mode === "exact")
          return [w];
        const keyer = (x) => mode === "endingStrip" ? [strip(x)] : stemKeys(x);
        const ks = keyer(w);
        const soft = softStemNoun(w);
        if (soft) {
          for (const sk of keyer(soft))
            if (!ks.includes(sk))
              ks.push(sk);
        }
        return ks;
      },
      lemma
    };
  }
});

// src/shared/morphology/languages/uk.js
var require_uk = __commonJS({
  "src/shared/morphology/languages/uk.js"(exports2, module2) {
    "use strict";
    var ENDINGS = [
      "\u0430\u043C\u0438",
      "\u044F\u043C\u0438",
      "\u043E\u0432\u0456",
      "\u0435\u0432\u0456",
      "\u043E\u0433\u043E",
      "\u043E\u043C\u0443",
      "\u0435\u043C\u0443",
      "\u0438\u043C\u0438",
      "\u0438\u0445",
      "\u0430\u0445",
      "\u044F\u0445",
      "\u0456\u0432",
      "\u043E\u044E",
      "\u0435\u044E",
      "\u043E\u043C",
      "\u0435\u043C",
      "\u0435\u0439",
      "\u0438\u0439",
      "\u0456\u0439",
      "\u0430",
      "\u044F",
      "\u0443",
      "\u044E",
      "\u0435",
      "\u043E",
      "\u0438",
      "\u0456",
      "\u0457",
      "\u044C"
    ].sort((a, b) => b.length - a.length);
    var CLOSED_SYLLABLE = /^(.*)і([^аеєиіїоуюя]+)$/;
    function strip(word) {
      const w = word.toLowerCase();
      for (const e of ENDINGS) {
        if (w.length - e.length >= 3 && w.endsWith(e))
          return w.slice(0, -e.length);
      }
      return w;
    }
    function alternations(stem) {
      const m = CLOSED_SYLLABLE.exec(stem);
      return m ? [m[1] + "\u043E" + m[2], m[1] + "\u0435" + m[2]] : [];
    }
    module2.exports = {
      id: "uk",
      name: "Ukrainian",
      priority: 0,
      match: (word) => /[а-яіїєґ]/i.test(word),
      keys(word, mode) {
        const w = word.toLowerCase();
        if (mode === "exact")
          return [w];
        if (mode === "endingStrip")
          return [strip(w)];
        const stem = strip(w);
        return [.../* @__PURE__ */ new Set([stem, ...alternations(stem)])];
      },
      lemma: (word) => strip(word)
    };
  }
});

// src/shared/morphology/languages/en.js
var require_en = __commonJS({
  "src/shared/morphology/languages/en.js"(exports2, module2) {
    "use strict";
    var STEP2 = { ational: "ate", tional: "tion", enci: "ence", anci: "ance", izer: "ize", bli: "ble", alli: "al", entli: "ent", eli: "e", ousli: "ous", ization: "ize", ation: "ate", ator: "ate", alism: "al", iveness: "ive", fulness: "ful", ousness: "ous", aliti: "al", iviti: "ive", biliti: "ble", logi: "log" };
    var STEP3 = { icate: "ic", ative: "", alize: "al", iciti: "ic", ical: "ic", ful: "", ness: "" };
    var C = "[^aeiou]";
    var V = "[aeiouy]";
    var CC = C + "[^aeiouy]*";
    var VV = V + "[aeiou]*";
    var MGR0 = new RegExp("^(" + CC + ")?" + VV + CC);
    var MEQ1 = new RegExp("^(" + CC + ")?" + VV + CC + "(" + VV + ")?$");
    var MGR1 = new RegExp("^(" + CC + ")?" + VV + CC + VV + CC);
    var S_V = new RegExp("^(" + CC + ")?" + V);
    function stem(word) {
      let w = word.toLowerCase();
      if (w.length < 3)
        return w;
      let st, suffix, fp, re, re2, re3, re4;
      const firstch = w.substr(0, 1);
      if (firstch === "y")
        w = firstch.toUpperCase() + w.substr(1);
      re = /^(.+?)(ss|i)es$/;
      re2 = /^(.+?)([^s])s$/;
      if (re.test(w))
        w = w.replace(re, "$1$2");
      else if (re2.test(w))
        w = w.replace(re2, "$1$2");
      re = /^(.+?)eed$/;
      re2 = /^(.+?)(ed|ing)$/;
      if (re.test(w)) {
        fp = re.exec(w);
        if (MGR0.test(fp[1]))
          w = w.replace(/.$/, "");
      } else if (re2.test(w)) {
        fp = re2.exec(w);
        st = fp[1];
        if (S_V.test(st)) {
          w = st;
          re2 = /(at|bl|iz)$/;
          re3 = /([^aeiouylsz])\1$/;
          re4 = new RegExp("^" + CC + V + "[^aeiouwxy]$");
          if (re2.test(w))
            w = w + "e";
          else if (re3.test(w))
            w = w.replace(/.$/, "");
          else if (re4.test(w))
            w = w + "e";
        }
      }
      re = /^(.+?)y$/;
      if (re.test(w)) {
        fp = re.exec(w);
        st = fp[1];
        if (S_V.test(st))
          w = st + "i";
      }
      re = /^(.+?)(ational|tional|enci|anci|izer|bli|alli|entli|eli|ousli|ization|ation|ator|alism|iveness|fulness|ousness|aliti|iviti|biliti|logi)$/;
      if (re.test(w)) {
        fp = re.exec(w);
        st = fp[1];
        suffix = fp[2];
        if (MGR0.test(st))
          w = st + STEP2[suffix];
      }
      re = /^(.+?)(icate|ative|alize|iciti|ical|ful|ness)$/;
      if (re.test(w)) {
        fp = re.exec(w);
        st = fp[1];
        suffix = fp[2];
        if (MGR0.test(st))
          w = st + STEP3[suffix];
      }
      re = /^(.+?)(al|ance|ence|er|ic|able|ible|ant|ement|ment|ent|ou|ism|ate|iti|ous|ive|ize)$/;
      re2 = /^(.+?)(s|t)(ion)$/;
      if (re.test(w)) {
        fp = re.exec(w);
        st = fp[1];
        if (MGR1.test(st))
          w = st;
      } else if (re2.test(w)) {
        fp = re2.exec(w);
        st = fp[1] + fp[2];
        if (MGR1.test(st))
          w = st;
      }
      re = /^(.+?)e$/;
      if (re.test(w)) {
        fp = re.exec(w);
        st = fp[1];
        re3 = new RegExp("^" + CC + V + "[^aeiouwxy]$");
        if (MGR1.test(st) || MEQ1.test(st) && !re3.test(st))
          w = st;
      }
      if (/ll$/.test(w) && MGR1.test(w))
        w = w.replace(/.$/, "");
      if (firstch === "y")
        w = firstch.toLowerCase() + w.substr(1);
      return w;
    }
    function strip(word) {
      const w = word.toLowerCase();
      if (w.length > 4 && w.endsWith("ies"))
        return w.slice(0, -3) + "y";
      if (w.length > 3 && w.endsWith("es"))
        return w.slice(0, -2);
      if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss"))
        return w.slice(0, -1);
      return w;
    }
    function stemKeys(word) {
      return [stem(word)];
    }
    function lemma(word) {
      return stem(word.toLowerCase());
    }
    module2.exports = {
      id: "en",
      name: "English",
      priority: 0,
      match: (word) => /[A-Za-z]/.test(word),
      keys(word, mode) {
        const w = word.toLowerCase();
        if (mode === "exact")
          return [w];
        if (mode === "endingStrip")
          return [strip(w)];
        return stemKeys(w);
      },
      lemma
    };
  }
});

// src/shared/morphology/languages/es.js
var require_es = __commonJS({
  "src/shared/morphology/languages/es.js"(exports2, module2) {
    "use strict";
    function fold(word) {
      return word.toLowerCase().replace(/[àáâä]/g, "a").replace(/[òóôö]/g, "o").replace(/[èéêë]/g, "e").replace(/[ùúûü]/g, "u").replace(/[ìíîï]/g, "i");
    }
    function stem(word) {
      const s = fold(word);
      const len = s.length;
      if (len < 5)
        return s;
      const last = s[len - 1];
      if (last === "o" || last === "a" || last === "e")
        return s.slice(0, len - 1);
      if (last === "s") {
        if (s[len - 2] === "e" && s[len - 3] === "s" && s[len - 4] === "e")
          return s.slice(0, len - 2);
        if (s[len - 2] === "e" && s[len - 3] === "c")
          return s.slice(0, len - 3) + "z";
        if (s[len - 2] === "o" || s[len - 2] === "a" || s[len - 2] === "e")
          return s.slice(0, len - 2);
      }
      return s;
    }
    function strip(word) {
      const s = fold(word);
      if (s.length > 4 && s.endsWith("ces"))
        return s.slice(0, -3) + "z";
      if (s.length > 3 && s.endsWith("es"))
        return s.slice(0, -2);
      if (s.length > 3 && s.endsWith("s"))
        return s.slice(0, -1);
      return s;
    }
    function stemKeys(word) {
      const a = stem(word);
      const b = strip(word);
      return a === b ? [a] : [a, b];
    }
    function lemma(word) {
      return strip(word);
    }
    module2.exports = {
      id: "es",
      name: "Spanish",
      priority: 0,
      match: (word) => /[a-záéíóúüñ]/i.test(word),
      keys(word, mode) {
        const w = word.toLowerCase();
        if (mode === "exact")
          return [w];
        if (mode === "endingStrip")
          return [strip(w)];
        return stemKeys(w);
      },
      lemma
    };
  }
});

// src/shared/morphology/languages/de.js
var require_de = __commonJS({
  "src/shared/morphology/languages/de.js"(exports2, module2) {
    "use strict";
    function fold(word) {
      return word.toLowerCase().replace(/ß/g, "ss").replace(/[äàáâ]/g, "a").replace(/[öòóô]/g, "o").replace(/[ïìíî]/g, "i").replace(/[üùúû]/g, "u");
    }
    function stEnding(ch) {
      return ch === "b" || ch === "d" || ch === "f" || ch === "g" || ch === "h" || ch === "k" || ch === "l" || ch === "m" || ch === "n" || ch === "t";
    }
    function step1(s, len) {
      if (len > 5 && s[len - 3] === "e" && s[len - 2] === "r" && s[len - 1] === "n")
        return len - 3;
      if (len > 4 && s[len - 2] === "e") {
        const c = s[len - 1];
        if (c === "m" || c === "n" || c === "r" || c === "s")
          return len - 2;
      }
      if (len > 3 && s[len - 1] === "e")
        return len - 1;
      if (len > 3 && s[len - 1] === "s" && stEnding(s[len - 2]))
        return len - 1;
      return len;
    }
    function step2(s, len) {
      if (len > 5 && s[len - 3] === "e" && s[len - 2] === "s" && s[len - 1] === "t")
        return len - 3;
      if (len > 4 && s[len - 2] === "e" && (s[len - 1] === "r" || s[len - 1] === "n"))
        return len - 2;
      if (len > 4 && s[len - 2] === "s" && s[len - 1] === "t" && stEnding(s[len - 3]))
        return len - 2;
      return len;
    }
    function stem(word) {
      const s = fold(word);
      let len = s.length;
      len = step1(s, len);
      len = step2(s, len);
      return s.slice(0, len);
    }
    function strip(word) {
      const s = fold(word);
      for (const e of ["en", "er", "es", "e", "n", "s"]) {
        if (s.length - e.length >= 3 && s.endsWith(e))
          return s.slice(0, -e.length);
      }
      return s;
    }
    function stemKeys(word) {
      const a = stem(word);
      const b = strip(word);
      return a === b ? [a] : [a, b];
    }
    function lemma(word) {
      return strip(word);
    }
    module2.exports = {
      id: "de",
      name: "German",
      priority: 0,
      match: (word) => /[a-zäöüß]/i.test(word),
      keys(word, mode) {
        const w = word.toLowerCase();
        if (mode === "exact")
          return [w];
        if (mode === "endingStrip")
          return [strip(w)];
        return stemKeys(w);
      },
      lemma
    };
  }
});

// src/shared/morphology/languages/fr.js
var require_fr = __commonJS({
  "src/shared/morphology/languages/fr.js"(exports2, module2) {
    "use strict";
    function endsWith(s, len, suffix) {
      const sl = suffix.length;
      if (sl > len)
        return false;
      for (let i = 0; i < sl; i++)
        if (s[len - sl + i] !== suffix[i])
          return false;
      return true;
    }
    function deleteAt(s, pos, len) {
      for (let i = pos; i < len - 1; i++)
        s[i] = s[i + 1];
      return len - 1;
    }
    function norm(s, len) {
      if (len > 4) {
        for (let i = 0; i < len; i++) {
          switch (s[i]) {
            case "\xE0":
            case "\xE1":
            case "\xE2":
              s[i] = "a";
              break;
            case "\xF4":
              s[i] = "o";
              break;
            case "\xE8":
            case "\xE9":
            case "\xEA":
              s[i] = "e";
              break;
            case "\xF9":
            case "\xFB":
              s[i] = "u";
              break;
            case "\xEE":
              s[i] = "i";
              break;
            case "\xE7":
              s[i] = "c";
              break;
          }
        }
        let ch = s[0];
        for (let i = 1; i < len; i++) {
          if (s[i] === ch && /[a-z]/.test(ch))
            len = deleteAt(s, i--, len);
          else
            ch = s[i];
        }
      }
      if (len > 4 && endsWith(s, len, "ie"))
        len -= 2;
      if (len > 4) {
        if (s[len - 1] === "r")
          len--;
        if (s[len - 1] === "e")
          len--;
        if (s[len - 1] === "e")
          len--;
        if (s[len - 1] === s[len - 2] && /[a-z]/.test(s[len - 1]))
          len--;
      }
      return len;
    }
    function stemArr(s, len) {
      if (len > 5 && s[len - 1] === "x") {
        if (s[len - 3] === "a" && s[len - 2] === "u" && s[len - 4] !== "e")
          s[len - 2] = "l";
        len--;
      }
      if (len > 3 && s[len - 1] === "x")
        len--;
      if (len > 3 && s[len - 1] === "s")
        len--;
      if (len > 9 && endsWith(s, len, "issement")) {
        len -= 6;
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 8 && endsWith(s, len, "issant")) {
        len -= 4;
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 6 && endsWith(s, len, "ement")) {
        len -= 4;
        if (len > 3 && endsWith(s, len, "ive")) {
          len--;
          s[len - 1] = "f";
        }
        return norm(s, len);
      }
      if (len > 11 && endsWith(s, len, "ficatrice")) {
        len -= 5;
        s[len - 2] = "e";
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 10 && endsWith(s, len, "ficateur")) {
        len -= 4;
        s[len - 2] = "e";
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 9 && endsWith(s, len, "catrice")) {
        len -= 3;
        s[len - 4] = "q";
        s[len - 3] = "u";
        s[len - 2] = "e";
        return norm(s, len);
      }
      if (len > 8 && endsWith(s, len, "cateur")) {
        len -= 2;
        s[len - 4] = "q";
        s[len - 3] = "u";
        s[len - 2] = "e";
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 8 && endsWith(s, len, "atrice")) {
        len -= 4;
        s[len - 2] = "e";
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 7 && endsWith(s, len, "ateur")) {
        len -= 3;
        s[len - 2] = "e";
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 6 && endsWith(s, len, "trice")) {
        len--;
        s[len - 3] = "e";
        s[len - 2] = "u";
        s[len - 1] = "r";
      }
      if (len > 5 && endsWith(s, len, "i\xE8me"))
        return norm(s, len - 4);
      if (len > 7 && endsWith(s, len, "teuse")) {
        len -= 2;
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 6 && endsWith(s, len, "teur")) {
        len--;
        s[len - 1] = "r";
        return norm(s, len);
      }
      if (len > 5 && endsWith(s, len, "euse"))
        return norm(s, len - 2);
      if (len > 8 && endsWith(s, len, "\xE8re")) {
        len--;
        s[len - 2] = "e";
        return norm(s, len);
      }
      if (len > 7 && endsWith(s, len, "ive")) {
        len--;
        s[len - 1] = "f";
        return norm(s, len);
      }
      if (len > 4 && (endsWith(s, len, "folle") || endsWith(s, len, "molle"))) {
        len -= 2;
        s[len - 1] = "u";
        return norm(s, len);
      }
      if (len > 9 && endsWith(s, len, "nnelle"))
        return norm(s, len - 5);
      if (len > 9 && endsWith(s, len, "nnel"))
        return norm(s, len - 3);
      if (len > 4 && endsWith(s, len, "\xE8te")) {
        len--;
        s[len - 2] = "e";
      }
      if (len > 8 && endsWith(s, len, "ique"))
        len -= 4;
      if (len > 8 && endsWith(s, len, "esse"))
        return norm(s, len - 3);
      if (len > 7 && endsWith(s, len, "inage"))
        return norm(s, len - 3);
      if (len > 9 && endsWith(s, len, "isation")) {
        len -= 7;
        if (len > 5 && endsWith(s, len, "ual"))
          s[len - 2] = "e";
        return norm(s, len);
      }
      if (len > 9 && endsWith(s, len, "isateur"))
        return norm(s, len - 7);
      if (len > 8 && endsWith(s, len, "ation"))
        return norm(s, len - 5);
      if (len > 8 && endsWith(s, len, "ition"))
        return norm(s, len - 5);
      return norm(s, len);
    }
    function stem(word) {
      const arr = word.toLowerCase().split("");
      const len = stemArr(arr, arr.length);
      return arr.slice(0, len).join("");
    }
    function fold(word) {
      return word.toLowerCase().replace(/[àâä]/g, "a").replace(/[ôö]/g, "o").replace(/[èéêë]/g, "e").replace(/[ùûü]/g, "u").replace(/[îï]/g, "i").replace(/ç/g, "c").replace(/ÿ/g, "y");
    }
    function strip(word) {
      const s = fold(word);
      if (s.length > 3 && (s.endsWith("s") || s.endsWith("x")))
        return s.slice(0, -1);
      return s;
    }
    function stemKeys(word) {
      const a = stem(word);
      const b = strip(word);
      return a === b ? [a] : [a, b];
    }
    function lemma(word) {
      return strip(word);
    }
    module2.exports = {
      id: "fr",
      name: "French",
      priority: 0,
      match: (word) => /[a-zàâäçéèêëîïôöùûüÿ]/i.test(word),
      keys(word, mode) {
        const w = word.toLowerCase();
        if (mode === "exact")
          return [w];
        if (mode === "endingStrip")
          return [strip(w)];
        return stemKeys(w);
      },
      lemma
    };
  }
});

// src/shared/morphology/builtin-languages.js
var require_builtin_languages = __commonJS({
  "src/shared/morphology/builtin-languages.js"(exports2, module2) {
    "use strict";
    var BUILTIN_LANGUAGES2 = [
      require_ru(),
      require_uk(),
      require_en(),
      require_es(),
      require_de(),
      require_fr()
    ];
    module2.exports = { BUILTIN_LANGUAGES: BUILTIN_LANGUAGES2 };
  }
});

// src/shared/morphology/language-api.js
var require_language_api = __commonJS({
  "src/shared/morphology/language-api.js"(exports2, module2) {
    "use strict";
    var MATCH_MODES = ["stemmer", "endingStrip", "exact"];
    var ID_PATTERN = /^[a-z][a-z0-9-]*$/;
    function validateLanguage2(lang) {
      if (!lang || typeof lang !== "object")
        return "module does not export an object";
      if (typeof lang.id !== "string" || !ID_PATTERN.test(lang.id))
        return 'invalid "id" (expected a lowercase code like "en")';
      if (typeof lang.name !== "string" || !lang.name.trim())
        return 'missing "name"';
      if ("priority" in lang && typeof lang.priority !== "number")
        return '"priority" must be a number';
      if (typeof lang.match !== "function")
        return "missing match(word) function";
      if (typeof lang.keys !== "function")
        return "missing keys(word, mode) function";
      if ("lemma" in lang && typeof lang.lemma !== "function")
        return '"lemma" must be a function';
      const sample = lang.id;
      try {
        lang.match(sample);
      } catch (e) {
        return `match() threw: ${e && e.message || e}`;
      }
      for (const mode of MATCH_MODES) {
        let out;
        try {
          out = lang.keys(sample, mode);
        } catch (e) {
          return `keys() threw in mode "${mode}": ${e && e.message || e}`;
        }
        if (!Array.isArray(out) || !out.length || out.some((k) => typeof k !== "string")) {
          return `keys() must return a non-empty array of strings (mode "${mode}")`;
        }
      }
      return null;
    }
    module2.exports = { MATCH_MODES, ID_PATTERN, validateLanguage: validateLanguage2 };
  }
});

// src/shared/prose/folder-suggest.js
var require_folder_suggest = __commonJS({
  "src/shared/prose/folder-suggest.js"(exports2, module2) {
    "use strict";
    var obsidian = require("obsidian");
    var { AbstractInputSuggest, TFolder: TFolder2 } = obsidian;
    var FolderSuggest = class extends AbstractInputSuggest {
      constructor(app, inputEl) {
        super(app, inputEl);
        this.inputEl = inputEl;
      }
      getSuggestions(query) {
        const q = query.toLowerCase();
        return this.app.vault.getAllLoadedFiles().filter((f) => f instanceof TFolder2 && f.path.toLowerCase().includes(q));
      }
      renderSuggestion(folder, el) {
        el.setText(folder.path || "/");
      }
      selectSuggestion(folder) {
        this.setValue(folder.path);
        this.inputEl.trigger("input");
        this.close();
      }
    };
    var FileSuggest = class extends AbstractInputSuggest {
      constructor(app, inputEl) {
        super(app, inputEl);
        this.inputEl = inputEl;
      }
      getSuggestions(query) {
        const q = query.toLowerCase();
        return this.app.vault.getMarkdownFiles().filter((f) => f.path.toLowerCase().includes(q)).slice(0, 50);
      }
      renderSuggestion(file, el) {
        el.setText(file.path);
      }
      selectSuggestion(file) {
        this.setValue(file.path);
        this.inputEl.trigger("input");
        this.close();
      }
    };
    var PathSuggest = class extends AbstractInputSuggest {
      constructor(app, inputEl, onSelect) {
        super(app, inputEl);
        this.inputEl = inputEl;
        this.onSelect = onSelect;
      }
      getSuggestions(query) {
        const q = query.toLowerCase();
        const isFolder = (f) => f instanceof TFolder2;
        return this.app.vault.getAllLoadedFiles().filter((f) => f.path && f.path.toLowerCase().includes(q)).sort((a, b) => isFolder(a) === isFolder(b) ? a.path.localeCompare(b.path) : isFolder(a) ? -1 : 1).slice(0, 50);
      }
      renderSuggestion(f, el) {
        el.setText(f.path || "/");
      }
      selectSuggestion(f) {
        if (this.onSelect) {
          this.onSelect(f.path);
          this.setValue("");
          this.close();
          return;
        }
        this.setValue(f.path);
        this.inputEl.trigger("input");
        this.close();
      }
    };
    var folderSuggestAvailable = () => typeof AbstractInputSuggest === "function";
    module2.exports = { FolderSuggest, FileSuggest, PathSuggest, folderSuggestAvailable };
  }
});

// src/shared/folder-list.js
var require_folder_list = __commonJS({
  "src/shared/folder-list.js"(exports2, module2) {
    "use strict";
    var { Setting, setIcon } = require("obsidian");
    function renderFolderList(containerEl, opts) {
      const cls = opts.cls;
      const norm = opts.normalize || ((x) => x.trim());
      const read = () => (opts.get() || "").split("\n").map((x) => x.trim()).filter(Boolean);
      new Setting(containerEl).setName(opts.name).setDesc(opts.desc);
      const rowsEl = containerEl.createDiv({ cls: `${cls}-folder-rows` });
      const addEl = containerEl.createDiv({ cls: `${cls}-folder-add` });
      const commit = async (next) => {
        const seen = /* @__PURE__ */ new Set();
        const clean = [];
        for (const p of next) {
          const n = norm(p);
          if (n && !seen.has(n)) {
            seen.add(n);
            clean.push(n);
          }
        }
        await opts.set(clean.join("\n"));
        draw();
      };
      const draw = () => {
        rowsEl.empty();
        read().forEach((path, i) => {
          const row = new Setting(rowsEl).setName(path);
          row.settingEl.addClass(`${cls}-folder-row`);
          row.addExtraButton((b) => b.setIcon("x").setTooltip(opts.removeLabel || "").onClick(() => {
            const next = read();
            next.splice(i, 1);
            commit(next);
          }));
        });
      };
      const input = addEl.createEl("input", { type: "text", cls: `${cls}-folder-input`, attr: { placeholder: opts.placeholder || "" } });
      const addBtn = addEl.createEl("button", { cls: `${cls}-folder-addbtn`, attr: { "aria-label": opts.addLabel || "" } });
      setIcon(addBtn, "plus");
      const add = (raw) => {
        if (norm(raw))
          commit([...read(), raw]);
        input.value = "";
        input.focus();
      };
      if (opts.attachSuggest)
        opts.attachSuggest(input, add);
      addBtn.addEventListener("click", () => add(input.value));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add(input.value);
        }
      });
      draw();
    }
    module2.exports = { renderFolderList };
  }
});

// src/shared/locales/common.js
var require_common = __commonJS({
  "src/shared/locales/common.js"(exports2, module2) {
    "use strict";
    var en = {
      "modal.andMore": "\u2026and {n} more",
      "btn.apply": "Apply",
      "btn.cancel": "Cancel",
      "set.heading.maintenance": "Maintenance",
      "set.rebuild.button": "Rebuild",
      "set.precedence.name": "Priority among linker plugins",
      "set.precedence.desc": "A word or link several linkers claim goes to the one highest in this list. You can only move this plugin \u2014 move the others from their own settings.",
      "set.precedence.other": "Moved from its own settings",
      "set.precedence.up": "Move up",
      "set.precedence.down": "Move down"
    };
    var ru = {
      "modal.andMore": "\u2026\u0438 \u0435\u0449\u0451 {n}",
      "btn.apply": "\u041F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C",
      "btn.cancel": "\u041E\u0442\u043C\u0435\u043D\u0430",
      "set.heading.maintenance": "\u041E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u043D\u0438\u0435",
      "set.rebuild.button": "\u041F\u0435\u0440\u0435\u0441\u0442\u0440\u043E\u0438\u0442\u044C",
      "set.precedence.name": "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442 \u0441\u0440\u0435\u0434\u0438 \u043F\u043B\u0430\u0433\u0438\u043D\u043E\u0432-\u043B\u0438\u043D\u043A\u0435\u0440\u043E\u0432",
      "set.precedence.desc": "\u0421\u043B\u043E\u0432\u043E \u0438\u043B\u0438 \u0441\u0441\u044B\u043B\u043A\u0443, \u043D\u0430 \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043F\u0440\u0435\u0442\u0435\u043D\u0434\u0443\u044E\u0442 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u043B\u0438\u043D\u043A\u0435\u0440\u043E\u0432, \u0437\u0430\u0431\u0438\u0440\u0430\u0435\u0442 \u0442\u043E\u0442, \u043A\u0442\u043E \u0432\u044B\u0448\u0435 \u0432 \u0441\u043F\u0438\u0441\u043A\u0435. \u041E\u0442\u0441\u044E\u0434\u0430 \u0434\u0432\u0438\u0433\u0430\u0435\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u044D\u0442\u043E\u0442 \u043F\u043B\u0430\u0433\u0438\u043D \u2014 \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0438\u0437 \u0441\u0432\u043E\u0438\u0445 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A.",
      "set.precedence.other": "\u0414\u0432\u0438\u0433\u0430\u0435\u0442\u0441\u044F \u0438\u0437 \u0441\u0432\u043E\u0438\u0445 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A",
      "set.precedence.up": "\u0412\u044B\u0448\u0435",
      "set.precedence.down": "\u041D\u0438\u0436\u0435"
    };
    var de = {
      "modal.andMore": "\u2026und {n} weitere",
      "btn.apply": "Anwenden",
      "btn.cancel": "Abbrechen",
      "set.heading.maintenance": "Wartung",
      "set.rebuild.button": "Neu aufbauen"
    };
    var es = {
      "modal.andMore": "\u2026y {n} m\xE1s",
      "btn.apply": "Aplicar",
      "btn.cancel": "Cancelar",
      "set.heading.maintenance": "Mantenimiento",
      "set.rebuild.button": "Reconstruir"
    };
    var fr = {
      "modal.andMore": "\u2026et {n} de plus",
      "btn.apply": "Appliquer",
      "btn.cancel": "Annuler",
      "set.heading.maintenance": "Maintenance",
      "set.rebuild.button": "Reconstruire"
    };
    var uk = {
      "modal.andMore": "\u2026\u0442\u0430 \u0449\u0435 {n}",
      "btn.apply": "\u0417\u0430\u0441\u0442\u043E\u0441\u0443\u0432\u0430\u0442\u0438",
      "btn.cancel": "\u0421\u043A\u0430\u0441\u0443\u0432\u0430\u0442\u0438",
      "set.heading.maintenance": "\u041E\u0431\u0441\u043B\u0443\u0433\u043E\u0432\u0443\u0432\u0430\u043D\u043D\u044F",
      "set.rebuild.button": "\u041F\u0435\u0440\u0435\u0431\u0443\u0434\u0443\u0432\u0430\u0442\u0438"
    };
    module2.exports = { en, ru, de, es, fr, uk };
  }
});

// src/shared/locales/prose.js
var require_prose = __commonJS({
  "src/shared/locales/prose.js"(exports2, module2) {
    "use strict";
    var en = {
      "noun.file": "file",
      "noun.folder": "folder",
      "scope.first": "first",
      "scope.all": "all",
      "menu.linkThisWord": "Link \u201C{display}\u201D",
      "menu.linkHere": "Link \u201C{display}\u201D here",
      "menu.linkDisplayTo": 'Link "{display}" to\u2026',
      "menu.linkScopeTo": 'Link {scope} "{display}" to\u2026',
      "menu.openThisWord": "Open \u201C{display}\u201D",
      "modal.choose.title": "Which one?",
      "set.heading.scope": "Scope",
      "set.heading.matching": "Matching",
      "set.languages.name": "Languages",
      "set.languages.show": "Show languages",
      "set.languages.hide": "Hide languages",
      "set.lang.higher": "Higher priority",
      "set.lang.lower": "Lower priority",
      "set.linkFirstOnly.name": "Link first occurrence only",
      "set.heading.highlighting": "Highlighting",
      "set.highlightInReading.name": "Highlight in Reading view",
      "set.editingHighlight.onSave": "On save",
      "set.skipHeadings.name": "Skip headings",
      "set.statusBar.name": "Status bar count",
      "set.heading.autocomplete": "Autocomplete",
      "set.linkSuggest.name": "Suggest links while typing",
      "set.suggestMinChars.desc": "How many characters to type before suggestions appear.",
      "set.suggestSkipAfter.name": "Skip after characters",
      "set.heading.contextMenu": "Context menu"
    };
    var ru = {
      "noun.file": "\u0444\u0430\u0439\u043B",
      "noun.folder": "\u043F\u0430\u043F\u043A\u0443",
      "scope.first": "\u043F\u0435\u0440\u0432\u043E\u0435",
      "scope.all": "\u0432\u0441\u0435",
      "menu.linkThisWord": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C \xAB{display}\xBB",
      "menu.linkHere": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C \xAB{display}\xBB \u0437\u0434\u0435\u0441\u044C",
      "menu.linkDisplayTo": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C \xAB{display}\xBB \u0441\u2026",
      "menu.linkScopeTo": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C {scope} \xAB{display}\xBB \u0441\u2026",
      "menu.openThisWord": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \xAB{display}\xBB",
      "modal.choose.title": "\u041A\u0430\u043A\u043E\u0435 \u0438\u0437 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439?",
      "set.heading.scope": "\u041E\u0431\u043B\u0430\u0441\u0442\u044C",
      "set.heading.matching": "\u0421\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u0435",
      "set.languages.name": "\u042F\u0437\u044B\u043A\u0438",
      "set.languages.show": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u044F\u0437\u044B\u043A\u0438",
      "set.languages.hide": "\u0421\u043A\u0440\u044B\u0442\u044C \u044F\u0437\u044B\u043A\u0438",
      "set.lang.higher": "\u0412\u044B\u0448\u0435 \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442",
      "set.lang.lower": "\u041D\u0438\u0436\u0435 \u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442",
      "set.linkFirstOnly.name": "\u0421\u0432\u044F\u0437\u044B\u0432\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0435\u0440\u0432\u043E\u0435 \u0432\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435",
      "set.heading.highlighting": "\u041F\u043E\u0434\u0441\u0432\u0435\u0442\u043A\u0430",
      "set.highlightInReading.name": "\u041F\u043E\u0434\u0441\u0432\u0435\u0442\u043A\u0430 \u0432 \u0440\u0435\u0436\u0438\u043C\u0435 \u0447\u0442\u0435\u043D\u0438\u044F",
      "set.editingHighlight.onSave": "\u041F\u0440\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438",
      "set.skipHeadings.name": "\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438",
      "set.statusBar.name": "\u0421\u0447\u0451\u0442\u0447\u0438\u043A \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F",
      "set.heading.autocomplete": "\u0410\u0432\u0442\u043E\u0434\u043E\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435",
      "set.linkSuggest.name": "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0438 \u043F\u0440\u0438 \u043D\u0430\u0431\u043E\u0440\u0435",
      "set.suggestMinChars.desc": "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u043D\u0430\u0431\u0440\u0430\u0442\u044C, \u043F\u0440\u0435\u0436\u0434\u0435 \u0447\u0435\u043C \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438.",
      "set.suggestSkipAfter.name": "\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u043F\u043E\u0441\u043B\u0435 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432",
      "set.heading.contextMenu": "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u0435 \u043C\u0435\u043D\u044E"
    };
    var de = {
      "noun.file": "Datei",
      "noun.folder": "Ordner",
      "scope.first": "erstes",
      "scope.all": "alle",
      "menu.linkDisplayTo": "\u201E{display}\u201C verlinken mit\u2026",
      "menu.linkScopeTo": "{scope} \u201E{display}\u201C verlinken mit\u2026",
      "modal.choose.title": "Begriff w\xE4hlen",
      "set.heading.scope": "Bereich",
      "set.heading.matching": "Abgleich",
      "set.languages.name": "Sprachen",
      "set.languages.show": "Sprachen anzeigen",
      "set.languages.hide": "Sprachen ausblenden",
      "set.lang.higher": "H\xF6here Priorit\xE4t",
      "set.lang.lower": "Niedrigere Priorit\xE4t",
      "set.linkFirstOnly.name": "Nur erstes Vorkommen verlinken",
      "set.heading.highlighting": "Hervorhebung",
      "set.highlightInReading.name": "In der Leseansicht hervorheben",
      "set.editingHighlight.onSave": "Beim Speichern",
      "set.skipHeadings.name": "\xDCberschriften \xFCberspringen",
      "set.statusBar.name": "Z\xE4hler in der Statusleiste",
      "set.heading.autocomplete": "Autovervollst\xE4ndigung",
      "set.linkSuggest.name": "Links w\xE4hrend der Eingabe vorschlagen",
      "set.suggestMinChars.desc": "Wie viele Zeichen einzugeben sind, bevor Vorschl\xE4ge erscheinen.",
      "set.suggestSkipAfter.name": "Nach Zeichen \xFCberspringen",
      "set.heading.contextMenu": "Kontextmen\xFC"
    };
    var es = {
      "noun.file": "archivo",
      "noun.folder": "carpeta",
      "scope.first": "la primera",
      "scope.all": "todas",
      "menu.linkDisplayTo": "Enlazar \xAB{display}\xBB con\u2026",
      "menu.linkScopeTo": "Enlazar {scope} \xAB{display}\xBB con\u2026",
      "modal.choose.title": "Elegir un t\xE9rmino",
      "set.heading.scope": "\xC1mbito",
      "set.heading.matching": "Coincidencia",
      "set.languages.name": "Idiomas",
      "set.languages.show": "Mostrar idiomas",
      "set.languages.hide": "Ocultar idiomas",
      "set.lang.higher": "Mayor prioridad",
      "set.lang.lower": "Menor prioridad",
      "set.linkFirstOnly.name": "Enlazar solo la primera aparici\xF3n",
      "set.heading.highlighting": "Resaltado",
      "set.highlightInReading.name": "Resaltar en vista de lectura",
      "set.editingHighlight.onSave": "Al guardar",
      "set.skipHeadings.name": "Omitir encabezados",
      "set.statusBar.name": "Contador en la barra de estado",
      "set.heading.autocomplete": "Autocompletado",
      "set.linkSuggest.name": "Sugerir enlaces al escribir",
      "set.suggestMinChars.desc": "Cu\xE1ntos caracteres escribir antes de que aparezcan las sugerencias.",
      "set.suggestSkipAfter.name": "Omitir tras caracteres",
      "set.heading.contextMenu": "Men\xFA contextual"
    };
    var fr = {
      "noun.file": "fichier",
      "noun.folder": "dossier",
      "scope.first": "la premi\xE8re",
      "scope.all": "toutes",
      "menu.linkDisplayTo": "Lier \xAB {display} \xBB \xE0\u2026",
      "menu.linkScopeTo": "Lier {scope} \xAB {display} \xBB \xE0\u2026",
      "modal.choose.title": "Choisir un terme",
      "set.heading.scope": "Port\xE9e",
      "set.heading.matching": "Correspondance",
      "set.languages.name": "Langues",
      "set.languages.show": "Afficher les langues",
      "set.languages.hide": "Masquer les langues",
      "set.lang.higher": "Priorit\xE9 plus haute",
      "set.lang.lower": "Priorit\xE9 plus basse",
      "set.linkFirstOnly.name": "Lier seulement la premi\xE8re occurrence",
      "set.heading.highlighting": "Surlignage",
      "set.highlightInReading.name": "Surligner en mode lecture",
      "set.editingHighlight.onSave": "\xC0 l\u2019enregistrement",
      "set.skipHeadings.name": "Ignorer les titres",
      "set.statusBar.name": "Compteur dans la barre d\u2019\xE9tat",
      "set.heading.autocomplete": "Autocompl\xE9tion",
      "set.linkSuggest.name": "Sugg\xE9rer des liens pendant la saisie",
      "set.suggestMinChars.desc": "Combien de caract\xE8res saisir avant que les suggestions apparaissent.",
      "set.suggestSkipAfter.name": "Ignorer apr\xE8s caract\xE8res",
      "set.heading.contextMenu": "Menu contextuel"
    };
    var uk = {
      "noun.file": "\u0444\u0430\u0439\u043B",
      "noun.folder": "\u0442\u0435\u043A\u0443",
      "scope.first": "\u043F\u0435\u0440\u0448\u0435",
      "scope.all": "\u0443\u0441\u0456",
      "menu.linkDisplayTo": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \xAB{display}\xBB \u0437\u2026",
      "menu.linkScopeTo": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 {scope} \xAB{display}\xBB \u0437\u2026",
      "modal.choose.title": "\u0412\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u0442\u0435\u0440\u043C\u0456\u043D",
      "set.heading.scope": "\u041E\u0431\u043B\u0430\u0441\u0442\u044C",
      "set.heading.matching": "\u0417\u0456\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044F",
      "set.languages.name": "\u041C\u043E\u0432\u0438",
      "set.languages.show": "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u0438 \u043C\u043E\u0432\u0438",
      "set.languages.hide": "\u0421\u0445\u043E\u0432\u0430\u0442\u0438 \u043C\u043E\u0432\u0438",
      "set.lang.higher": "\u0412\u0438\u0449\u0438\u0439 \u043F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442",
      "set.lang.lower": "\u041D\u0438\u0436\u0447\u0438\u0439 \u043F\u0440\u0456\u043E\u0440\u0438\u0442\u0435\u0442",
      "set.linkFirstOnly.name": "\u0417\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u0442\u0438 \u043B\u0438\u0448\u0435 \u043F\u0435\u0440\u0448\u0435 \u0432\u0445\u043E\u0434\u0436\u0435\u043D\u043D\u044F",
      "set.heading.highlighting": "\u041F\u0456\u0434\u0441\u0432\u0456\u0447\u0443\u0432\u0430\u043D\u043D\u044F",
      "set.highlightInReading.name": "\u041F\u0456\u0434\u0441\u0432\u0456\u0447\u0443\u0432\u0430\u0442\u0438 \u0432 \u0440\u0435\u0436\u0438\u043C\u0456 \u0447\u0438\u0442\u0430\u043D\u043D\u044F",
      "set.editingHighlight.onSave": "\u041F\u0456\u0434 \u0447\u0430\u0441 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F",
      "set.skipHeadings.name": "\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0442\u0438 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0438",
      "set.statusBar.name": "\u041B\u0456\u0447\u0438\u043B\u044C\u043D\u0438\u043A \u0443 \u0440\u044F\u0434\u043A\u0443 \u0441\u0442\u0430\u043D\u0443",
      "set.heading.autocomplete": "\u0410\u0432\u0442\u043E\u0434\u043E\u043F\u043E\u0432\u043D\u0435\u043D\u043D\u044F",
      "set.linkSuggest.name": "\u041F\u0440\u043E\u043F\u043E\u043D\u0443\u0432\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043F\u0456\u0434 \u0447\u0430\u0441 \u043D\u0430\u0431\u043E\u0440\u0443",
      "set.suggestMinChars.desc": "\u0421\u043A\u0456\u043B\u044C\u043A\u0438 \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432 \u043D\u0430\u0431\u0440\u0430\u0442\u0438, \u043F\u0435\u0440\u0448 \u043D\u0456\u0436 \u0437\u2019\u044F\u0432\u043B\u044F\u0442\u044C\u0441\u044F \u043F\u0456\u0434\u043A\u0430\u0437\u043A\u0438.",
      "set.suggestSkipAfter.name": "\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0442\u0438 \u043F\u0456\u0441\u043B\u044F \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432",
      "set.heading.contextMenu": "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u0435 \u043C\u0435\u043D\u044E"
    };
    module2.exports = { en, ru, de, es, fr, uk };
  }
});

// src/shared/locales/sigil.js
var require_sigil = __commonJS({
  "src/shared/locales/sigil.js"(exports2, module2) {
    "use strict";
    var en = {
      "menu.convert": "Find and convert to link",
      "menu.convert.group": "Find and convert to link",
      "menu.open.group": "Find and open",
      "notice.updateSkipped": "({n} note(s) skipped \u2014 changed since the preview)",
      "embed.menu.refresh": "Refresh embed",
      "modal.embedPlaceholder": "Choose an embed format\u2026",
      "modal.update.summary": "{links} change(s) across {files} note(s). Uncheck any change to skip it, or a note to skip all of its changes.",
      "modal.update.upToDate": "Everything is up to date \u2014 nothing to update.",
      "btn.close": "Close",
      "label.thisNote": "This note",
      "set.heading.suggestions": "Suggestions & links",
      "set.heading.hover": "Hover preview",
      "set.heading.links": "Links",
      "set.codeRoot.desc": "Base folder the scan paths are relative to. Empty = the folder containing this vault.",
      "set.scanFolders.name": "Scan folders",
      "set.folderList.add": "Add folder\u2026",
      "set.folderList.remove": "Remove",
      "set.folderList.addAria": "Add",
      "set.skipFolders.name": "Skip folders",
      "set.trigger.name": "Trigger",
      "set.preset.file": "file://",
      "set.preset.ask": "Always ask",
      "set.editors.count": "{n} added",
      "set.editors.collapse": "Collapse",
      "set.editors.expand": "Expand",
      "set.editors.namePlaceholder": "Name",
      "set.editors.remove": "Remove",
      "set.minChars.name": "Min characters",
      "set.minChars.desc": "How many characters to type before suggestions appear.",
      "set.maxResults.name": "Max results",
      "set.maxResults.desc": "Most suggestions to show at once.",
      "set.autoRefresh.name": "Auto-refresh index",
      "set.autoRefresh.unsupported": "Recursive folder watching isn\u2019t supported on this platform (Linux); rebuild manually instead.",
      "set.contextMenu.name": "Editor context menu",
      "set.markStaleLinks.name": "Mark stale links",
      "set.info.unknownRoot": "(unknown)",
      "plural.entry": { one: "{n} entry", other: "{n} entries" }
    };
    var ru = {
      "menu.convert": "\u041D\u0430\u0439\u0442\u0438 \u0438 \u043F\u0440\u0435\u0432\u0440\u0430\u0442\u0438\u0442\u044C \u0432 \u0441\u0441\u044B\u043B\u043A\u0443",
      "menu.convert.group": "\u041D\u0430\u0439\u0442\u0438 \u0438 \u043F\u0440\u0435\u0432\u0440\u0430\u0442\u0438\u0442\u044C \u0432 \u0441\u0441\u044B\u043B\u043A\u0443",
      "menu.open.group": "\u041D\u0430\u0439\u0442\u0438 \u0438 \u043E\u0442\u043A\u0440\u044B\u0442\u044C",
      "notice.updateSkipped": "(\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E \u0437\u0430\u043C\u0435\u0442\u043E\u043A \u2014 {n}: \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0438\u0441\u044C \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430)",
      "embed.menu.refresh": "\u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C embed",
      "modal.embedPlaceholder": "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0444\u043E\u0440\u043C\u0430\u0442 embed\u2026",
      "modal.update.summary": "\u041F\u0440\u0430\u0432\u043E\u043A \u2014 {links} \u0432 \u0437\u0430\u043C\u0435\u0442\u043A\u0430\u0445: {files}. \u0421\u043D\u0438\u043C\u0438\u0442\u0435 \u0433\u0430\u043B\u043E\u0447\u043A\u0443 \u0441 \u043F\u0440\u0430\u0432\u043A\u0438, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0435\u0451, \u0438\u043B\u0438 \u0441 \u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u2014 \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0432\u0441\u0435 \u0435\u0451 \u043F\u0440\u0430\u0432\u043A\u0438.",
      "modal.update.upToDate": "\u0412\u0441\u0451 \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u043E \u2014 \u043E\u0431\u043D\u043E\u0432\u043B\u044F\u0442\u044C \u043D\u0435\u0447\u0435\u0433\u043E.",
      "btn.close": "\u0417\u0430\u043A\u0440\u044B\u0442\u044C",
      "label.thisNote": "\u042D\u0442\u0430 \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
      "set.heading.suggestions": "\u041F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 \u0438 \u0441\u0441\u044B\u043B\u043A\u0438",
      "set.heading.hover": "\u041F\u0440\u0435\u0432\u044C\u044E \u043F\u0440\u0438 \u043D\u0430\u0432\u0435\u0434\u0435\u043D\u0438\u0438",
      "set.heading.links": "\u0421\u0441\u044B\u043B\u043A\u0438",
      "set.codeRoot.desc": "\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u043F\u0430\u043F\u043A\u0430, \u043E\u0442\u043D\u043E\u0441\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u0437\u0430\u0434\u0430\u044E\u0442\u0441\u044F \u043F\u0443\u0442\u0438 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F. \u041F\u0443\u0441\u0442\u043E = \u043F\u0430\u043F\u043A\u0430, \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0449\u0430\u044F \u044D\u0442\u043E \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435.",
      "set.scanFolders.name": "\u041F\u0430\u043F\u043A\u0438 \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F",
      "set.folderList.add": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0430\u043F\u043A\u0443\u2026",
      "set.folderList.remove": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
      "set.folderList.addAria": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C",
      "set.skipFolders.name": "\u041F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u043C\u044B\u0435 \u043F\u0430\u043F\u043A\u0438",
      "set.trigger.name": "\u0422\u0440\u0438\u0433\u0433\u0435\u0440",
      "set.preset.file": "file://",
      "set.preset.ask": "\u0412\u0441\u0435\u0433\u0434\u0430 \u0441\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0442\u044C",
      "set.editors.count": "\u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E: {n}",
      "set.editors.collapse": "\u0421\u0432\u0435\u0440\u043D\u0443\u0442\u044C",
      "set.editors.expand": "\u0420\u0430\u0437\u0432\u0435\u0440\u043D\u0443\u0442\u044C",
      "set.editors.namePlaceholder": "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435",
      "set.editors.remove": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
      "set.minChars.name": "\u041C\u0438\u043D\u0438\u043C\u0443\u043C \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432",
      "set.minChars.desc": "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u0432\u0432\u0435\u0441\u0442\u0438, \u043F\u0440\u0435\u0436\u0434\u0435 \u0447\u0435\u043C \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438.",
      "set.maxResults.name": "\u041C\u0430\u043A\u0441\u0438\u043C\u0443\u043C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432",
      "set.maxResults.desc": "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043E\u043A \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043E\u0434\u043D\u043E\u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E.",
      "set.autoRefresh.name": "\u0410\u0432\u0442\u043E\u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u0435 \u0438\u043D\u0434\u0435\u043A\u0441\u0430",
      "set.autoRefresh.unsupported": "\u0420\u0435\u043A\u0443\u0440\u0441\u0438\u0432\u043D\u043E\u0435 \u0441\u043B\u0435\u0436\u0435\u043D\u0438\u0435 \u0437\u0430 \u043F\u0430\u043F\u043A\u0430\u043C\u0438 \u043D\u0435 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u044D\u0442\u043E\u0439 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0435 (Linux); \u043F\u0435\u0440\u0435\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0439\u0442\u0435 \u0432\u0440\u0443\u0447\u043D\u0443\u044E.",
      "set.contextMenu.name": "\u041A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u0435 \u043C\u0435\u043D\u044E \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430",
      "set.markStaleLinks.name": "\u041E\u0442\u043C\u0435\u0447\u0430\u0442\u044C \u0443\u0441\u0442\u0430\u0440\u0435\u0432\u0448\u0438\u0435 \u0441\u0441\u044B\u043B\u043A\u0438",
      "set.info.unknownRoot": "(\u043D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u043E)",
      "plural.entry": { one: "{n} \u0437\u0430\u043F\u0438\u0441\u044C", few: "{n} \u0437\u0430\u043F\u0438\u0441\u0438", many: "{n} \u0437\u0430\u043F\u0438\u0441\u0435\u0439", other: "{n} \u0437\u0430\u043F\u0438\u0441\u0435\u0439" }
    };
    module2.exports = { en, ru };
  }
});

// src/shared/i18n.js
var require_i18n = __commonJS({
  "src/shared/i18n.js"(exports2, module2) {
    "use strict";
    var LOCALES = { en: {} };
    var dict = LOCALES.en;
    var pluralRules = new Intl.PluralRules("en");
    function initI18n2(locales) {
      LOCALES = locales;
      const sys = (window.localStorage.getItem("language") || "").split("-")[0].toLowerCase();
      const locale = LOCALES[sys] ? sys : "en";
      dict = LOCALES[locale];
      try {
        pluralRules = new Intl.PluralRules(locale);
      } catch (e) {
        pluralRules = new Intl.PluralRules("en");
      }
    }
    function interpolate(str, vars) {
      if (!vars)
        return str;
      return str.replace(/\{(\w+)\}/g, (m, k) => k in vars ? String(vars[k]) : m);
    }
    function t2(key, vars) {
      let entry = dict[key];
      if (entry === void 0)
        entry = LOCALES.en[key];
      if (entry === void 0)
        return key;
      return interpolate(entry, vars);
    }
    function plural2(noun, n) {
      const forms = dict["plural." + noun] || LOCALES.en["plural." + noun];
      if (!forms)
        return n + " " + noun;
      let cat;
      try {
        cat = pluralRules.select(n);
      } catch (e) {
        cat = "other";
      }
      const tpl = forms[cat] != null ? forms[cat] : forms.other != null ? forms.other : Object.values(forms)[0];
      return interpolate(tpl, { n });
    }
    var FAMILY = {
      common: require_common(),
      prose: require_prose(),
      sigil: require_sigil()
    };
    function withFamily2(kind, pluginLocales) {
      const common = FAMILY.common;
      const pair = FAMILY[kind] || {};
      const out = {};
      for (const lang of Object.keys(pluginLocales)) {
        out[lang] = Object.assign({}, common[lang], pair[lang], pluginLocales[lang]);
      }
      return out;
    }
    module2.exports = { initI18n: initI18n2, t: t2, plural: plural2, withFamily: withFamily2 };
  }
});

// src/shared/discover.js
var require_discover = __commonJS({
  "src/shared/discover.js"(exports2, module2) {
    "use strict";
    var LINKER_API = 1;
    function discoverLinkers(app, opts) {
      const minVersion = opts && opts.minVersion || LINKER_API;
      const found = [];
      const plugins = app && app.plugins && app.plugins.plugins;
      if (!plugins)
        return found;
      for (const id of Object.keys(plugins)) {
        const plugin = plugins[id];
        const provider = plugin && plugin.api && plugin.api.linker;
        if (!provider || typeof provider.id !== "string")
          continue;
        if (!(provider.apiVersion >= minVersion))
          continue;
        found.push(provider);
      }
      return found;
    }
    function outranks(a, b) {
      if (a.precedence !== b.precedence)
        return (a.precedence || 0) > (b.precedence || 0);
      return String(a.id) < String(b.id);
    }
    function foreignRanges(app, self, text) {
      const ranges = [];
      for (const peer of discoverLinkers(app)) {
        if (peer.id === self.id || !outranks(peer, self))
          continue;
        if (typeof peer.matches !== "function")
          continue;
        let matches;
        try {
          matches = peer.matches(text) || [];
        } catch (e) {
          matches = [];
        }
        for (const m of matches) {
          if (m && typeof m.start === "number" && typeof m.end === "number")
            ranges.push([m.start, m.end]);
        }
      }
      return ranges.sort((a, b) => a[0] - b[0]);
    }
    function overlaps(ranges, s, e) {
      for (const [rs, re] of ranges) {
        if (rs >= e)
          break;
        if (re > s)
          return true;
      }
      return false;
    }
    function ownedMatches(app, self, text, matches) {
      if (!matches.length)
        return matches;
      const foreign = foreignRanges(app, self, text);
      if (!foreign.length)
        return matches;
      return matches.filter((m) => !overlaps(foreign, m.start, m.end));
    }
    function yieldedCandidates(app, self, text) {
      const out = [];
      for (const peer of discoverLinkers(app)) {
        if (peer.id === self.id || outranks(peer, self))
          continue;
        if (typeof peer.matches !== "function")
          continue;
        let matches;
        try {
          matches = peer.matches(text) || [];
        } catch (e) {
          matches = [];
        }
        for (const m of matches) {
          if (!m || typeof m.start !== "number" || typeof m.end !== "number")
            continue;
          out.push({
            start: m.start,
            end: m.end,
            label: m.label || m.target || "",
            target: m.target,
            // The id survives a round trip through a DOM attribute; the opener is looked up
            // again at click time.
            id: peer.id,
            source: peer.displayName || peer.id,
            open: (sourcePath, newTab) => {
              if (typeof peer.open === "function")
                peer.open(m.target, sourcePath, newTab);
            },
            hover: (event, targetEl, sourcePath, hoverParent) => {
              if (typeof peer.hover === "function")
                peer.hover(m.target, event, targetEl, sourcePath, hoverParent);
            }
          });
        }
      }
      return out;
    }
    function candidatesFor(candidates, s, e) {
      return candidates.filter((c) => c.start < e && c.end > s);
    }
    function peerSuggestions(app, self, query) {
      const out = [];
      for (const peer of discoverLinkers(app)) {
        if (peer.id === self.id || typeof peer.suggest !== "function")
          continue;
        let items;
        try {
          items = peer.suggest(String(query || "")) || [];
        } catch (e) {
          items = [];
        }
        for (const it of items) {
          if (!it || typeof it.label !== "string")
            continue;
          out.push({
            label: it.label,
            note: it.note || "",
            target: it.target,
            // null means "keep what the reader typed"; only the peer knows whether its
            // candidate matched an inflection or completed a prefix.
            display: it.display == null ? null : it.display,
            id: peer.id,
            source: peer.displayName || peer.id,
            precedence: peer.precedence || 0,
            insert: (display, inTable) => typeof peer.linkFor === "function" ? peer.linkFor(it.target, display, inTable) : null
          });
        }
      }
      return out;
    }
    function peersOffering(app, self, kind, text) {
      const out = [];
      for (const peer of discoverLinkers(app)) {
        if (peer.id === self.id || typeof peer.offers !== "function")
          continue;
        let yes;
        try {
          yes = peer.offers(kind, text);
        } catch (e) {
          yes = false;
        }
        if (yes)
          out.push(peer);
      }
      return out;
    }
    function siblingLinkers(app, self) {
      return discoverLinkers(app).filter((p) => p.id !== self.id);
    }
    module2.exports = { LINKER_API, discoverLinkers, outranks, foreignRanges, overlaps, ownedMatches, yieldedCandidates, candidatesFor, peerSuggestions, peersOffering, siblingLinkers };
  }
});

// src/shared/precedence.js
var require_precedence = __commonJS({
  "src/shared/precedence.js"(exports2, module2) {
    "use strict";
    var { discoverLinkers, outranks, siblingLinkers } = require_discover();
    var STEP = 10;
    function rankedLinkers(app) {
      return discoverLinkers(app).slice().sort((a, b) => {
        if (outranks(a, b))
          return -1;
        if (outranks(b, a))
          return 1;
        return 0;
      });
    }
    function precedenceForIndex(app, self, index) {
      const others = rankedLinkers(app).filter((p) => p.id !== self.id);
      if (!others.length)
        return self.precedence || 0;
      const at = Math.max(0, Math.min(index, others.length));
      const above = at > 0 ? others[at - 1].precedence || 0 : null;
      const below = at < others.length ? others[at].precedence || 0 : null;
      if (above === null)
        return below + STEP;
      if (below === null)
        return above - STEP;
      return (above + below) / 2;
    }
    function currentIndex(app, self) {
      return rankedLinkers(app).findIndex((p) => p.id === self.id);
    }
    function renderPrecedence(containerEl, opts) {
      const { app, provider, Setting, name, desc, save } = opts;
      if (!provider || !siblingLinkers(app, provider).length)
        return;
      new Setting(containerEl).setName(name).setDesc(desc);
      const cls = opts.cls || "linker";
      const list = containerEl.createDiv({ cls: `${cls}-precedence-list` });
      const draw = () => {
        list.empty();
        const ranked = rankedLinkers(app);
        ranked.forEach((p, i) => {
          const mine = p.id === provider.id;
          const row = new Setting(list).setName(`${i + 1}. ${p.displayName || p.id}`);
          if (!mine) {
            row.setDesc(opts.otherDesc || "");
            return;
          }
          row.settingEl.addClass(`${cls}-precedence-self`);
          row.addExtraButton((b) => b.setIcon("arrow-up").setTooltip(opts.upTooltip || "").setDisabled(i === 0).onClick(async () => {
            await save(precedenceForIndex(app, provider, i - 1));
            refresh();
          }));
          row.addExtraButton((b) => b.setIcon("arrow-down").setTooltip(opts.downTooltip || "").setDisabled(i === ranked.length - 1).onClick(async () => {
            await save(precedenceForIndex(app, provider, i + 1));
            refresh();
          }));
        });
      };
      const refresh = () => {
        for (const p of siblingLinkers(app, provider)) {
          if (typeof p.refresh === "function") {
            try {
              p.refresh();
            } catch (e) {
            }
          }
        }
        draw();
      };
      draw();
    }
    module2.exports = { STEP, rankedLinkers, precedenceForIndex, currentIndex, renderPrecedence };
  }
});

// src/settings-tab.js
var require_settings_tab = __commonJS({
  "src/settings-tab.js"(exports2, module2) {
    "use strict";
    var { PluginSettingTab, Setting, Notice: Notice2, TFolder: TFolder2 } = require("obsidian");
    var { sanitizeFolder: sanitizeFolder2 } = require_constants();
    var { FolderSuggest, FileSuggest, PathSuggest, folderSuggestAvailable } = require_folder_suggest();
    var { renderFolderList } = require_folder_list();
    var { t: t2, plural: plural2 } = require_i18n();
    var { renderPrecedence: precedenceSetting } = require_precedence();
    var GlossaryLinkerSettingTab2 = class extends PluginSettingTab {
      constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
      }
      display() {
        const { containerEl } = this;
        containerEl.empty();
        const s = this.plugin.settings;
        const save = async (rebuild) => {
          await this.plugin.saveSettings();
          if (rebuild) {
            this.plugin.rebuildIndex();
            this.plugin.rerenderViews();
            this.plugin.updateStatusBar();
          }
        };
        const saveScope = async () => {
          await this.plugin.saveSettings();
          this.plugin.rerenderViews();
          this.plugin.updateStatusBar();
          this.plugin.refreshOverviewDebounced();
        };
        new Setting(containerEl).setName(t2("set.heading.scope")).setHeading();
        new Setting(containerEl).setName(t2("set.glossaryFolder.name")).setDesc(t2("set.glossaryFolder.desc")).addText((c) => {
          c.setValue(s.glossaryFolder).onChange(async (v) => {
            s.glossaryFolder = sanitizeFolder2(v);
            await save(true);
            this.renderFolderStatus();
            this.plugin.refreshOverviewDebounced();
          });
          if (folderSuggestAvailable())
            new FolderSuggest(this.app, c.inputEl);
        });
        new Setting(containerEl).setName(t2("set.termTemplate.name")).setDesc(t2("set.termTemplate.desc")).addText((c) => {
          c.setValue(s.termTemplate).onChange(async (v) => {
            s.termTemplate = v.trim();
            await save(false);
          });
          if (folderSuggestAvailable())
            new FileSuggest(this.app, c.inputEl);
        });
        new Setting(containerEl).setName(t2("set.scopeMode.name")).setDesc(t2("set.scopeMode.desc")).addDropdown((d) => d.addOption("folders", t2("set.scopeMode.folders")).addOption("vault", t2("set.scopeMode.vault")).setValue(s.scopeMode).onChange(async (v) => {
          s.scopeMode = v;
          await saveScope();
          this.display();
        }));
        const folderList = (name, desc, key) => renderFolderList(containerEl, {
          cls: "glossary",
          name,
          desc,
          get: () => s[key],
          set: async (v) => {
            s[key] = v;
            await saveScope();
          },
          normalize: sanitizeFolder2,
          attachSuggest: folderSuggestAvailable() ? (inputEl, onPick) => new PathSuggest(this.app, inputEl, onPick) : null,
          placeholder: t2("set.folderList.add"),
          removeLabel: t2("set.folderList.remove"),
          addLabel: t2("set.folderList.addAria")
        });
        if (s.scopeMode === "folders") {
          folderList(t2("set.scopeFolders.name"), t2("set.scopeFolders.desc"), "scopeFolders");
        }
        folderList(t2("set.excludeFolders.name"), t2("set.excludeFolders.desc"), "excludeFolders");
        this.folderStatusEl = containerEl.createEl("div", { cls: "glossary-section-desc" });
        this.renderFolderStatus();
        new Setting(containerEl).setName(t2("set.heading.matching")).setHeading();
        new Setting(containerEl).setName(t2("set.matchMode.name")).setDesc(t2("set.matchMode.desc")).addDropdown((d) => d.addOption("stemmer", t2("set.matchMode.stemmer")).addOption("endingStrip", t2("set.matchMode.endingStrip")).addOption("exact", t2("set.matchMode.exact")).setValue(s.matchMode).onChange(async (v) => {
          s.matchMode = v;
          await save(true);
        }));
        new Setting(containerEl).setName(t2("set.minTermLength.name")).setDesc(t2("set.minTermLength.desc")).addText((c) => {
          c.inputEl.type = "number";
          c.inputEl.min = "1";
          c.setValue(String(s.minTermLength)).onChange(async (v) => {
            const n = parseInt(v, 10);
            s.minTermLength = Number.isFinite(n) && n > 0 ? n : 1;
            await save(true);
          });
        });
        const langs = this.plugin.languages;
        const errors = this.plugin.languageErrors || [];
        const enabledCount = langs.filter((l) => (s.enabledLanguages || []).includes(l.id)).length;
        if (this.showLanguages === void 0)
          this.showLanguages = false;
        const langDesc = t2("set.languages.desc", { enabled: enabledCount, total: langs.length }) + (errors.length ? t2("set.languages.invalidSuffix", { n: errors.length }) : "") + ".";
        new Setting(containerEl).setName(t2("set.languages.name")).setDesc(langDesc).addExtraButton((b) => b.setIcon(this.showLanguages ? "chevron-up" : "chevron-down").setTooltip(this.showLanguages ? t2("set.languages.hide") : t2("set.languages.show")).onClick(() => {
          this.showLanguages = !this.showLanguages;
          this.display();
        }));
        if (this.showLanguages) {
          langs.forEach((lang, i) => {
            const row = new Setting(containerEl).setName(lang.name).setDesc(`id: ${lang.id}`).addExtraButton((b) => b.setIcon("chevron-up").setTooltip(t2("set.lang.higher")).setDisabled(i === 0).onClick(async () => {
              this.plugin.moveLanguage(lang.id, -1);
              await this.applyLanguageChange();
            })).addExtraButton((b) => b.setIcon("chevron-down").setTooltip(t2("set.lang.lower")).setDisabled(i === langs.length - 1).onClick(async () => {
              this.plugin.moveLanguage(lang.id, 1);
              await this.applyLanguageChange();
            })).addToggle((c) => c.setValue((s.enabledLanguages || []).includes(lang.id)).onChange(async (v) => {
              const set = new Set(s.enabledLanguages || []);
              if (v)
                set.add(lang.id);
              else
                set.delete(lang.id);
              s.enabledLanguages = [...set];
              await this.applyLanguageChange();
            }));
            row.settingEl.addClass("glossary-lang-row");
          });
          for (const bad of errors) {
            const row = new Setting(containerEl).setName(bad.id).setDesc(t2("set.lang.invalid", { error: bad.error })).addExtraButton((b) => b.setIcon("alert-triangle").setTooltip(t2("set.lang.invalid", { error: bad.error })).setDisabled(true));
            row.nameEl.addClass("glossary-lang-error");
            row.settingEl.addClass("glossary-lang-row");
            row.settingEl.addClass("mod-warning");
          }
        }
        new Setting(containerEl).setName(t2("set.linkFirstOnly.name")).setDesc(t2("set.linkFirstOnly.desc")).addToggle((c) => c.setValue(s.linkFirstOnly).onChange(async (v) => {
          s.linkFirstOnly = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.excludeTerms.name")).setDesc(t2("set.excludeTerms.desc")).addTextArea((c) => {
          c.setValue(s.excludeTerms).onChange(async (v) => {
            s.excludeTerms = v;
            await save(true);
          });
          c.inputEl.rows = 3;
        });
        new Setting(containerEl).setName(t2("set.excludeWords.name")).setDesc(t2("set.excludeWords.desc")).addTextArea((c) => {
          c.setValue(s.excludeWords).onChange(async (v) => {
            s.excludeWords = v;
            await save(true);
          });
          c.inputEl.rows = 3;
        });
        new Setting(containerEl).setName(t2("set.heading.highlighting")).setHeading();
        new Setting(containerEl).setName(t2("set.highlightInReading.name")).setDesc(t2("set.highlightInReading.desc")).addToggle((c) => c.setValue(s.highlightInReading).onChange(async (v) => {
          s.highlightInReading = v;
          await save(false);
          this.plugin.rerenderViews();
        }));
        new Setting(containerEl).setName(t2("set.editingHighlight.name")).setDesc(t2("set.editingHighlight.desc")).addDropdown((d) => d.addOption("off", t2("set.editingHighlight.off")).addOption("live", t2("set.editingHighlight.live")).addOption("onSave", t2("set.editingHighlight.onSave")).setValue(s.editingHighlight).onChange(async (v) => {
          s.editingHighlight = v;
          await save(false);
          this.plugin.refreshEditors();
        }));
        new Setting(containerEl).setName(t2("set.skipHeadings.name")).setDesc(t2("set.skipHeadings.desc")).addToggle((c) => c.setValue(s.skipHeadings).onChange(async (v) => {
          s.skipHeadings = v;
          await save(false);
          this.plugin.rerenderViews();
        }));
        new Setting(containerEl).setName(t2("set.statusBar.name")).setDesc(t2("set.statusBar.desc")).addToggle((c) => c.setValue(s.statusBar).onChange(async (v) => {
          s.statusBar = v;
          await save(false);
          this.plugin.updateStatusBar();
        }));
        new Setting(containerEl).setName(t2("set.statusBarIncludeLinks.name")).setDesc(t2("set.statusBarIncludeLinks.desc")).addToggle((c) => c.setValue(s.statusBarIncludeLinks).onChange(async (v) => {
          s.statusBarIncludeLinks = v;
          await save(false);
          this.plugin.updateStatusBar();
        }));
        new Setting(containerEl).setName(t2("set.heading.autocomplete")).setHeading();
        new Setting(containerEl).setName(t2("set.linkSuggest.name")).setDesc(t2("set.linkSuggest.desc")).addToggle((c) => c.setValue(s.linkSuggest).onChange(async (v) => {
          s.linkSuggest = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.suggestMinChars.name")).setDesc(t2("set.suggestMinChars.desc")).addText((c) => {
          c.inputEl.type = "number";
          c.inputEl.min = "1";
          c.setValue(String(s.suggestMinChars)).onChange(async (v) => {
            const n = parseInt(v, 10);
            s.suggestMinChars = Number.isFinite(n) && n > 0 ? n : 1;
            await save(false);
          });
        });
        new Setting(containerEl).setName(t2("set.suggestSkipAfter.name")).setDesc(t2("set.suggestSkipAfter.desc")).addText((c) => c.setValue(s.suggestSkipAfter).onChange(async (v) => {
          s.suggestSkipAfter = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.heading.collecting")).setDesc(t2("set.collecting.desc")).setHeading();
        new Setting(containerEl).setName(t2("set.aliasHarvestMode.name")).setDesc(t2("set.aliasHarvestMode.desc")).addDropdown((d) => d.addOption("lemma", t2("set.aliasHarvestMode.lemma")).addOption("literal", t2("set.aliasHarvestMode.literal")).addOption("both", t2("set.aliasHarvestMode.both")).setValue(s.aliasHarvestMode).onChange(async (v) => {
          s.aliasHarvestMode = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.harvestOnSave.name")).setDesc(t2("set.harvestOnSave.desc")).addDropdown((d) => d.addOption("off", t2("set.harvestOnSave.off")).addOption("silent", t2("set.harvestOnSave.silent")).addOption("preview", t2("set.harvestOnSave.preview")).setValue(s.harvestOnSave).onChange(async (v) => {
          s.harvestOnSave = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.harvestSingleWordOnly.name")).setDesc(t2("set.harvestSingleWordOnly.desc")).addToggle((c) => c.setValue(s.harvestSingleWordOnly).onChange(async (v) => {
          s.harvestSingleWordOnly = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.harvestMinLength.name")).setDesc(t2("set.harvestMinLength.desc")).addText((c) => {
          c.inputEl.type = "number";
          c.inputEl.min = "1";
          c.setValue(String(s.harvestMinLength)).onChange(async (v) => {
            const n = parseInt(v, 10);
            s.harvestMinLength = Number.isFinite(n) && n > 0 ? n : 1;
            await save(false);
          });
        });
        new Setting(containerEl).setName(t2("set.aliasCollisionWarnings.name")).setDesc(t2("set.aliasCollisionWarnings.desc")).addToggle((c) => c.setValue(s.aliasCollisionWarnings).onChange(async (v) => {
          s.aliasCollisionWarnings = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.heading.contextMenu")).setHeading();
        new Setting(containerEl).setName(t2("set.menuTurnInto.name")).setDesc(t2("set.menuTurnInto.desc")).addToggle((c) => c.setValue(s.menuTurnInto).onChange(async (v) => {
          s.menuTurnInto = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.menuCollect.name")).setDesc(t2("set.menuCollect.desc")).addToggle((c) => c.setValue(s.menuCollect).onChange(async (v) => {
          s.menuCollect = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.menuExclude.name")).setDesc(t2("set.menuExclude.desc")).addToggle((c) => c.setValue(s.menuExclude).onChange(async (v) => {
          s.menuExclude = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.menuOpen.name")).setDesc(t2("set.menuOpen.desc")).addToggle((c) => c.setValue(s.menuOpen).onChange(async (v) => {
          s.menuOpen = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.menuCreateTerm.name")).setDesc(t2("set.menuCreateTerm.desc")).addToggle((c) => c.setValue(s.menuCreateTerm).onChange(async (v) => {
          s.menuCreateTerm = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.menuAddAlias.name")).setDesc(t2("set.menuAddAlias.desc")).addToggle((c) => c.setValue(s.menuAddAlias).onChange(async (v) => {
          s.menuAddAlias = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.menuUnlink.name")).setDesc(t2("set.menuUnlink.desc")).addToggle((c) => c.setValue(s.menuUnlink).onChange(async (v) => {
          s.menuUnlink = v;
          await save(false);
        }));
        new Setting(containerEl).setName(t2("set.heading.overview")).setHeading();
        new Setting(containerEl).setName(t2("set.showRibbonIcon.name")).setDesc(t2("set.showRibbonIcon.desc")).addToggle((c) => c.setValue(s.showRibbonIcon).onChange(async (v) => {
          s.showRibbonIcon = v;
          await save(false);
          this.plugin.applyRibbonIcon();
        }));
        new Setting(containerEl).setName(t2("set.heading.maintenance")).setHeading();
        this.renderPrecedence(containerEl, save);
        new Setting(containerEl).setName(t2("set.rebuild.name")).setDesc(t2("set.rebuild.desc")).addButton((b) => b.setButtonText(t2("set.rebuild.button")).onClick(() => {
          this.plugin.rebuildIndex();
          new Notice2(t2("notice.indexRebuilt"));
          this.renderFolderStatus();
        }));
      }
      async applyLanguageChange() {
        await this.plugin.saveSettings();
        this.plugin.refreshActiveLanguages();
        this.plugin.rebuildIndex();
        this.plugin.rerenderViews();
        this.display();
      }
      // Where this plugin sits in the family-wide priority order. Shown only when another linker
      // is installed — alone there is no order to argue about.
      renderPrecedence(containerEl, save) {
        precedenceSetting(containerEl, {
          app: this.app,
          provider: this.plugin.api && this.plugin.api.linker,
          Setting,
          cls: "glossary",
          name: t2("set.precedence.name"),
          desc: t2("set.precedence.desc"),
          otherDesc: t2("set.precedence.other"),
          upTooltip: t2("set.precedence.up"),
          downTooltip: t2("set.precedence.down"),
          save: async (value) => {
            this.plugin.settings.linkPrecedence = value;
            await save(false);
          }
        });
      }
      renderFolderStatus() {
        const el = this.folderStatusEl;
        if (!el)
          return;
        el.empty();
        el.removeClass("glossary-lang-error");
        const path = (this.plugin.settings.glossaryFolder || "").replace(/\/+$/, "");
        const n = this.plugin.index && this.plugin.index.termCount || 0;
        if (!path) {
          el.setText(t2("set.wholeVaultStatus", { terms: plural2("term", n) }));
          return;
        }
        const f = this.app.vault.getAbstractFileByPath(path);
        if (!(f instanceof TFolder2)) {
          el.addClass("glossary-lang-error");
          el.setText(t2("set.folderNotFound"));
          return;
        }
        el.setText(t2("set.termsIndexed", { terms: plural2("term", n) }));
      }
    };
    module2.exports = { GlossaryLinkerSettingTab: GlossaryLinkerSettingTab2 };
  }
});

// src/shared/prose/matcher.js
var require_matcher = __commonJS({
  "src/shared/prose/matcher.js"(exports2, module2) {
    "use strict";
    var PROTECT = [
      /```[\s\S]*?```/g,
      /~~~[\s\S]*?~~~/g,
      /`[^`\n]+`/g,
      /%%[\s\S]*?%%/g,
      /\[\[[^\]]*\]\]/g,
      /\[[^\]]*\]\([^)]*\)/g,
      /(?:https?:\/\/|www\.)\S+/g
    ];
    var PROTECT_INLINE = [
      /`[^`\n]+`/g,
      /%%[^%\n]*%%/g,
      /\[\[[^\]]*\]\]/g,
      /\[[^\]]*\]\([^)]*\)/g,
      /(?:https?:\/\/|www\.)\S+/g
    ];
    var frontmatterEnd = (text) => {
      if (!/^---\r?\n/.test(text))
        return -1;
      const end = text.indexOf("\n---", 3);
      return end === -1 ? -1 : end + 4;
    };
    function inMatch(line, col, re) {
      let m;
      while ((m = re.exec(line)) !== null) {
        if (col > m.index && col < m.index + m[0].length)
          return true;
      }
      return false;
    }
    function createMatcher(config) {
      const { idOf, selfIdOf, fieldsOf } = config;
      const accepts = config.accepts || (() => true);
      const caseFits = config.caseFits || (() => true);
      return {
        // Keys for a word: the union from every language that claims it (same-script
        // languages overlap); words no language claims fall back to the exact form.
        keysFor(word) {
          const cacheKey = word.toLowerCase();
          if (!this.keysCache)
            this.keysCache = /* @__PURE__ */ new Map();
          const cached = this.keysCache.get(cacheKey);
          if (cached)
            return cached;
          const out = [];
          const seen = /* @__PURE__ */ new Set();
          for (const lang of this.activeLanguages) {
            if (!lang.match(word))
              continue;
            for (const k of lang.keys(word, this.settings.matchMode)) {
              if (!seen.has(k)) {
                seen.add(k);
                out.push(k);
              }
            }
          }
          if (!out.length)
            out.push(cacheKey);
          this.keysCache.set(cacheKey, out);
          return out;
        },
        tokenizeForm(form) {
          const words = [...form.matchAll(/[\p{L}\p{Nd}]+/gu)].map((m) => m[0]);
          return words.map((raw) => ({ raw, keys: this.keysFor(raw) }));
        },
        // Every term id whose form matches `text`, `except` one. Runs the same scan as the
        // highlighter, so collisions agree with what actually gets linked.
        termsMatchingText(text, except) {
          const out = /* @__PURE__ */ new Set();
          for (const m of this.findMatches(text, null)) {
            out.add(idOf(m));
            if (m.alts)
              for (const a of m.alts)
                out.add(a);
          }
          if (except)
            out.delete(except);
          return [...out];
        },
        // `selfId` identifies the note being scanned when it is itself a term source; its own
        // entries are skipped so a note doesn't link to itself.
        findMatches(text, selfId, opts = {}) {
          const protect = opts.protect ? this.computeProtected(text) : null;
          const tokens = [...text.matchAll(/[\p{L}\p{Nd}]+/gu)].map((m) => {
            const raw = m[0];
            return { raw, start: m.index, end: m.index + raw.length, keys: this.keysFor(raw) };
          });
          const results = [];
          let i = 0;
          while (i < tokens.length) {
            const tk = tokens[i];
            const cands = [];
            const seen = /* @__PURE__ */ new Set();
            for (const k of tk.keys) {
              const bucket = this.index.byKey.get(k);
              if (!bucket)
                continue;
              for (const c of bucket) {
                if (!seen.has(c)) {
                  seen.add(c);
                  cands.push(c);
                }
              }
            }
            const fits = (c) => {
              const wc = c.wordCount;
              if (i + wc > tokens.length)
                return false;
              for (let k = 0; k < wc; k++) {
                const t2 = tokens[i + k];
                const w = c.words[k];
                if (k > 0) {
                  const between = text.slice(tokens[i + k - 1].end, t2.start);
                  if (/[^\s-]/.test(between))
                    return false;
                }
                const t2keys = k === 0 ? t2.keys : this.keysFor(t2.raw);
                if (!t2keys.some((kk) => w.keys.includes(kk)))
                  return false;
              }
              return caseFits(this, c, text.slice(tokens[i].start, tokens[i + wc - 1].end));
            };
            let matched = null;
            let sorted = null;
            if (cands.length) {
              sorted = cands.length > 1 ? cands.slice().sort((a, b) => b.wordCount - a.wordCount) : cands;
              for (const c of sorted) {
                if (fits(c)) {
                  matched = { c, start: tokens[i].start, end: tokens[i + c.wordCount - 1].end, wc: c.wordCount };
                  break;
                }
              }
            }
            if (matched && selfIdOf(matched.c) !== selfId) {
              const inProtected = protect && this.overlapsProtected(protect, matched.start, matched.end);
              if (accepts(this, matched, tk) && !inProtected) {
                let alts = null;
                if (sorted.length > 1) {
                  const seenId = /* @__PURE__ */ new Set([idOf(matched.c)]);
                  for (const c of sorted) {
                    if (c.wordCount !== matched.wc || seenId.has(idOf(c)))
                      continue;
                    if (fits(c)) {
                      seenId.add(idOf(c));
                      (alts || (alts = [])).push(idOf(c));
                    }
                  }
                }
                results.push(Object.assign({
                  start: matched.start,
                  end: matched.end,
                  display: text.slice(matched.start, matched.end),
                  alts
                }, fieldsOf(matched.c)));
                i += matched.wc;
                continue;
              }
            }
            i++;
          }
          return results;
        },
        // Ranges in raw markdown that must not be linked: frontmatter, code, comments, links,
        // urls and — when the setting asks — headings.
        computeProtected(text) {
          const ranges = [];
          const fm = frontmatterEnd(text);
          if (fm !== -1)
            ranges.push([0, fm]);
          for (const re of PROTECT) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null)
              ranges.push([m.index, m.index + m[0].length]);
          }
          if (this.settings.skipHeadings) {
            const re = /^[ \t]*#{1,6}[ \t].*$/gm;
            let m;
            while ((m = re.exec(text)) !== null)
              ranges.push([m.index, m.index + m[0].length]);
          }
          return ranges.sort((a, b) => a[0] - b[0]);
        },
        // Frontmatter and code (fenced or inline) — the spans where a [[...]] isn't a real link.
        // Unlike computeProtected it keeps wikilinks and headings, since unlink acts on links and
        // a link inside a heading is still real.
        codeFrontmatterRanges(text) {
          const ranges = [];
          const fm = frontmatterEnd(text);
          if (fm !== -1)
            ranges.push([0, fm]);
          for (const re of [/```[\s\S]*?```/g, /~~~[\s\S]*?~~~/g, /`[^`\n]+`/g]) {
            re.lastIndex = 0;
            let m;
            while ((m = re.exec(text)) !== null)
              ranges.push([m.index, m.index + m[0].length]);
          }
          return ranges.sort((a, b) => a[0] - b[0]);
        },
        overlapsProtected(ranges, s, e) {
          for (const [rs, re] of ranges) {
            if (rs >= e)
              break;
            if (re > s)
              return true;
          }
          return false;
        },
        // Same spans as computeProtected, but tested at a single position so it stays cheap on
        // every keystroke — no whole-document scan with greedy [\s\S]*? regexes.
        isProtectedAt(text, pos) {
          const fm = frontmatterEnd(text);
          if (fm !== -1 && pos <= fm)
            return true;
          const lines = text.split("\n");
          let lineStart = 0, lineIdx = 0;
          for (; lineIdx < lines.length; lineIdx++) {
            if (pos <= lineStart + lines[lineIdx].length)
              break;
            lineStart += lines[lineIdx].length + 1;
          }
          let fenced = false;
          for (let i = 0; i < lineIdx; i++) {
            const s = lines[i].trimStart();
            if (s.startsWith("```") || s.startsWith("~~~"))
              fenced = !fenced;
          }
          if (fenced)
            return true;
          const line = lines[lineIdx] || "";
          if (this.settings.skipHeadings && /^[ \t]*#{1,6}[ \t]/.test(line))
            return true;
          const col = pos - lineStart;
          return PROTECT_INLINE.some((re) => {
            re.lastIndex = 0;
            return inMatch(line, col, re);
          });
        }
      };
    }
    module2.exports = { createMatcher };
  }
});

// src/matcher.js
var require_matcher2 = __commonJS({
  "src/matcher.js"(exports2, module2) {
    "use strict";
    var { splitLines: splitLines2 } = require_markdown();
    var { createMatcher } = require_matcher();
    var core = createMatcher({
      idOf: (c) => c.canonical,
      selfIdOf: (c) => c.canonical,
      fieldsOf: (c) => ({ canonical: c.canonical }),
      // A single word on the excluded-words list never becomes a link, even when a term matches
      // it. Multi-word matches are left alone: "cell" being excluded should not stop "stem cell".
      accepts: (plugin, matched, token) => !(matched.wc === 1 && token.keys.some((k) => plugin.excludeWordKeys.has(k)))
    });
    module2.exports = Object.assign({}, core, {
      // Base form for collected aliases: the first claiming language wins (by priority).
      lemmaFor(word) {
        for (const lang of this.activeLanguages) {
          if (lang.match(word))
            return lang.lemma ? lang.lemma(word) : word.toLowerCase();
        }
        return word.toLowerCase();
      },
      rebuildIndex() {
        this.keysCache = /* @__PURE__ */ new Map();
        const byKey = /* @__PURE__ */ new Map();
        const canonicals = /* @__PURE__ */ new Set();
        const terms = [];
        const minTermLength = Math.max(1, this.settings.minTermLength || 1);
        const excludeTerms = new Set(splitLines2(this.settings.excludeTerms).map((s) => s.toLowerCase()));
        this.excludeWordKeys = /* @__PURE__ */ new Set();
        for (const w of splitLines2(this.settings.excludeWords)) {
          for (const k of this.keysFor(w))
            this.excludeWordKeys.add(k);
        }
        const files = this.app.vault.getMarkdownFiles().filter((f) => this.isGlossaryFile(f));
        for (const file of files) {
          const canonical = file.basename;
          const aliases = this.aliasesOf(file);
          this.aliasFingerprints.set(file.path, JSON.stringify(aliases));
          if ([canonical, ...aliases].some((f) => excludeTerms.has(f.toLowerCase())))
            continue;
          const forms = [canonical, ...aliases].filter((x) => typeof x === "string" && x.trim());
          const target = { canonical, path: file.path };
          canonicals.add(canonical);
          terms.push({ canonical, path: file.path, aliases });
          for (const form of forms) {
            if (form.trim().length < minTermLength)
              continue;
            const words = this.tokenizeForm(form);
            if (!words.length)
              continue;
            if (words.length === 1 && words[0].keys.some((k) => this.excludeWordKeys.has(k)))
              continue;
            const matcher2 = { canonical, target, words, wordCount: words.length };
            for (const k of words[0].keys) {
              if (!byKey.has(k))
                byKey.set(k, []);
              byKey.get(k).push(matcher2);
            }
          }
        }
        this.index = { byKey, termCount: canonicals.size };
        this.terms = terms;
        this.notifyIndexChange();
      }
    });
  }
});

// src/shared/prose/highlight.js
var require_highlight = __commonJS({
  "src/shared/prose/highlight.js"(exports2, module2) {
    "use strict";
    var { t: t2 } = require_i18n();
    var { ownedMatches, yieldedCandidates, candidatesFor, discoverLinkers } = require_discover();
    function createHighlight(config) {
      const { cls, displayName, targetOf, selfIdFor } = config;
      const LINK_CLASS = `${cls}-link`;
      const AMBIGUOUS_CLASS = `${cls}-ambiguous`;
      const CM_LINK_CLASS = `cm-${cls}-link`;
      const CM_AMBIGUOUS_CLASS = `cm-${cls}-ambiguous`;
      const ATTR_TARGET = `data-${cls}-target`;
      const ATTR_ALTS = `data-${cls}-alts`;
      const ATTR_FOREIGN = `data-${cls}-foreign`;
      return {
        // Our matches minus the ones a higher-ranked sibling also claims.
        ownSpans(text, matches) {
          const provider = this.api && this.api.linker;
          if (!provider)
            return matches;
          return ownedMatches(this.app, provider, text, matches);
        },
        // What the linkers that yielded a span to us would have offered there.
        yieldedIn(text) {
          const provider = this.api && this.api.linker;
          if (!provider)
            return [];
          return yieldedCandidates(this.app, provider, text);
        },
        processReadingMode(el, ctx) {
          if (!this.settings.highlightInReading)
            return;
          const sourcePath = ctx.sourcePath;
          if (sourcePath && !this.inScope(sourcePath))
            return;
          const selfId = selfIdFor(this, sourcePath);
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
            acceptNode: (node) => {
              let p = node.parentElement;
              while (p) {
                const tag = p.tagName;
                if (tag === "CODE" || tag === "PRE" || tag === "A")
                  return NodeFilter.FILTER_REJECT;
                if (this.settings.skipHeadings && /^H[1-6]$/.test(tag))
                  return NodeFilter.FILTER_REJECT;
                if (p.classList && p.classList.contains(LINK_CLASS))
                  return NodeFilter.FILTER_REJECT;
                if (p === el)
                  break;
                p = p.parentElement;
              }
              return NodeFilter.FILTER_ACCEPT;
            }
          });
          const nodes = [];
          while (walker.nextNode())
            nodes.push(walker.currentNode);
          for (const node of nodes)
            this.decorateTextNode(node, selfId, sourcePath);
        },
        decorateTextNode(node, selfId, sourcePath) {
          const text = node.textContent;
          if (!text || text.length < 2)
            return;
          const matches = this.ownSpans(text, this.findMatches(text, selfId, { protect: true }));
          if (!matches.length)
            return;
          const yielded = this.yieldedIn(text);
          const frag = document.createDocumentFragment();
          let cursor = 0;
          for (const m of matches) {
            if (m.start > cursor)
              frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
            const target = targetOf(m);
            const display = m.display;
            const foreign = candidatesFor(yielded, m.start, m.end);
            const alts = [...m.alts || [], ...foreign];
            const a = document.createElement("a");
            a.textContent = display;
            a.setAttribute(ATTR_TARGET, target);
            if (alts.length) {
              a.className = `${LINK_CLASS} ${AMBIGUOUS_CLASS}`;
              const candidates = [target, ...alts];
              const pick = (e, newTab) => {
                e.preventDefault();
                e.stopPropagation();
                this.chooseTerm(
                  candidates.map((c) => typeof c === "object" ? { ...c, open: () => c.open(sourcePath, newTab) } : c),
                  newTab ? t2("menu.openNewTabTitle") : t2("menu.openTitle"),
                  (c) => this.openTerm(c, sourcePath, newTab)
                );
              };
              a.addEventListener("mouseenter", (e) => {
                if (!this.choices)
                  return;
                this.choices.schedule(candidates.map((c) => typeof c === "object" ? {
                  label: c.label,
                  open: () => c.open(sourcePath, false),
                  hover: (ev, row, parent) => c.hover(ev, row, sourcePath, parent)
                } : c), e.clientX, e.clientY);
              });
              a.addEventListener("mouseleave", () => {
                if (this.choices)
                  this.choices.leave();
              });
              a.addEventListener("click", (e) => pick(e, e.ctrlKey || e.metaKey));
              a.addEventListener("auxclick", (e) => {
                if (e.button === 1)
                  pick(e, true);
              });
              a.addEventListener("mousedown", (e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  e.stopPropagation();
                }
              });
            } else {
              a.className = `internal-link ${LINK_CLASS}`;
              a.href = target;
              a.setAttribute("data-href", target);
            }
            frag.appendChild(a);
            cursor = m.end;
          }
          if (cursor < text.length)
            frag.appendChild(document.createTextNode(text.slice(cursor)));
          node.parentNode.replaceChild(frag, node);
        },
        // Always registered; the editingHighlight setting controls if and how often it recomputes.
        registerEditingHighlight() {
          let view, state, language;
          try {
            view = require("@codemirror/view");
            state = require("@codemirror/state");
            language = require("@codemirror/language");
          } catch (e) {
            console.warn(`${displayName}: CM6 modules unavailable, editor highlight disabled`, e);
            return;
          }
          const { ViewPlugin, Decoration } = view;
          const { RangeSetBuilder, StateEffect } = state;
          const { syntaxTree } = language;
          const plugin = this;
          const refresh = StateEffect.define();
          this.cmRefreshEffect = refresh;
          const markCache = /* @__PURE__ */ new Map();
          const markFor = (target) => {
            let m = markCache.get(target);
            if (!m) {
              m = Decoration.mark({ class: CM_LINK_CLASS, attributes: { [ATTR_TARGET]: target } });
              markCache.set(target, m);
            }
            return m;
          };
          const markWithAlts = (target, alts, foreign) => {
            const attributes = {
              [ATTR_TARGET]: target,
              [ATTR_ALTS]: alts.join("\n")
            };
            if (foreign.length) {
              attributes[ATTR_FOREIGN] = JSON.stringify(foreign.map((f) => ({ id: f.id, label: f.label, target: f.target, source: f.source })));
            }
            return Decoration.mark({ class: `${CM_LINK_CLASS} ${CM_AMBIGUOUS_CLASS}`, attributes });
          };
          const skipNode = (name) => /code|link|url|header|hashtag|frontmatter|comment|tag|escape/i.test(name);
          const buildDeco = (editorView) => {
            const builder = new RangeSetBuilder();
            const activeFile = plugin.app.workspace.getActiveFile();
            if (activeFile && !plugin.inScope(activeFile.path))
              return builder.finish();
            const selfId = activeFile ? selfIdFor(plugin, activeFile.path) : null;
            const tree = syntaxTree(editorView.state);
            for (const { from, to } of editorView.visibleRanges) {
              const text = editorView.state.doc.sliceString(from, to);
              const yielded = plugin.yieldedIn(text);
              for (const m of plugin.ownSpans(text, plugin.findMatches(text, selfId))) {
                const start = from + m.start;
                const end = from + m.end;
                let skip = false;
                tree.iterate({ from: start, to: end, enter: (n) => {
                  if (skipNode(n.type.name))
                    skip = true;
                } });
                if (skip)
                  continue;
                const alts = m.alts || [];
                const foreign = candidatesFor(yielded, m.start, m.end);
                builder.add(start, end, alts.length || foreign.length ? markWithAlts(targetOf(m), alts, foreign) : markFor(targetOf(m)));
              }
            }
            return builder.finish();
          };
          const targetEl = (e) => e.target instanceof HTMLElement ? e.target.closest("." + CM_LINK_CLASS) : null;
          const targetOfEl = (el) => el.getAttribute(ATTR_TARGET);
          const altsOf = (el) => {
            const v = el.getAttribute(ATTR_ALTS);
            return v ? v.split("\n") : null;
          };
          const foreignOf = (el, sourcePath, newTab) => {
            const raw = el.getAttribute(ATTR_FOREIGN);
            if (!raw)
              return [];
            let parsed;
            try {
              parsed = JSON.parse(raw);
            } catch (err) {
              return [];
            }
            const peers = discoverLinkers(plugin.app);
            return parsed.map((f) => {
              const peerOf = () => peers.find((p) => p.id === f.id);
              return {
                label: f.label,
                source: f.source,
                open: () => {
                  const peer = peerOf();
                  if (peer && typeof peer.open === "function")
                    peer.open(f.target, sourcePath, newTab);
                },
                hover: (ev, row, parent) => {
                  const peer = peerOf();
                  if (peer && typeof peer.hover === "function")
                    peer.hover(f.target, ev, row, sourcePath, parent);
                }
              };
            });
          };
          const candidatesOn = (el, sourcePath) => [targetOfEl(el), ...altsOf(el) || [], ...foreignOf(el, sourcePath, false)];
          let lastX = 0;
          let lastY = 0;
          plugin.registerDomEvent(document, "mousemove", (e) => {
            lastX = e.clientX;
            lastY = e.clientY;
          });
          plugin.registerDomEvent(document, "keydown", (e) => {
            if (!plugin.choices || !(e.ctrlKey || e.metaKey))
              return;
            const under = document.elementFromPoint(lastX, lastY);
            const el = under && under.closest ? under.closest("." + CM_LINK_CLASS) : null;
            if (!el || !(el.hasAttribute(ATTR_ALTS) || el.hasAttribute(ATTR_FOREIGN)))
              return;
            const file = plugin.app.workspace.getActiveFile();
            plugin.choices.schedule(candidatesOn(el, file ? file.path : ""), lastX, lastY);
          });
          const vp = ViewPlugin.fromClass(
            class {
              constructor(v) {
                this.decorations = plugin.settings.editingHighlight === "off" ? Decoration.none : buildDeco(v);
              }
              update(u) {
                const mode = plugin.settings.editingHighlight;
                if (mode === "off") {
                  if (this.decorations.size)
                    this.decorations = Decoration.none;
                  return;
                }
                const forced = u.transactions.some((tr) => tr.effects.some((e) => e.is(refresh)));
                if (u.viewportChanged || forced || mode === "live" && (u.docChanged || u.selectionSet)) {
                  this.decorations = buildDeco(u.view);
                } else if (u.docChanged) {
                  this.decorations = this.decorations.map(u.changes);
                }
              }
            },
            {
              decorations: (v) => v.decorations,
              eventHandlers: {
                mousedown(e) {
                  const el = targetEl(e);
                  if (!el)
                    return;
                  const file = plugin.app.workspace.getActiveFile();
                  const sourcePath = file ? file.path : "";
                  const alts = altsOf(el) || [];
                  const pick = (newTab, title) => {
                    const candidates = [targetOfEl(el), ...alts, ...foreignOf(el, sourcePath, newTab)];
                    plugin.chooseTerm(candidates, title, (c) => plugin.openTerm(c, sourcePath, newTab));
                  };
                  if (e.button === 1) {
                    pick(true, t2("menu.openNewTabTitle"));
                    e.preventDefault();
                    return;
                  }
                  if (e.button !== 0 || !(e.ctrlKey || e.metaKey))
                    return;
                  pick(false, t2("menu.openTitle"));
                  e.preventDefault();
                },
                mouseover(e) {
                  const el = targetEl(e);
                  if (!el)
                    return;
                  const file = plugin.app.workspace.getActiveFile();
                  const sourcePath = file ? file.path : "";
                  if (el.hasAttribute(ATTR_ALTS) || el.hasAttribute(ATTR_FOREIGN)) {
                    if (!plugin.choices || !(e.ctrlKey || e.metaKey))
                      return;
                    plugin.choices.schedule(candidatesOn(el, sourcePath), e.clientX, e.clientY);
                    return;
                  }
                  plugin.hoverTerm(e, el, targetOfEl(el), sourcePath);
                },
                mouseout(e) {
                  if (targetEl(e) && plugin.choices)
                    plugin.choices.leave();
                }
                // No contextmenu handler: a right-click already raises Obsidian's menu, and
                // everything we offer for the word under the cursor is added there.
              }
            }
          );
          this.registerEditorExtension(vp);
        }
      };
    }
    module2.exports = { createHighlight };
  }
});

// src/highlight.js
var require_highlight2 = __commonJS({
  "src/highlight.js"(exports2, module2) {
    "use strict";
    var { createHighlight } = require_highlight();
    module2.exports = createHighlight({
      cls: "glossary",
      displayName: "Glossary Linker",
      targetOf: (m) => m.canonical,
      selfIdFor: (plugin, sourcePath) => plugin.canonicalForPath(sourcePath)
    });
  }
});

// src/modals.js
var require_modals = __commonJS({
  "src/modals.js"(exports2, module2) {
    "use strict";
    var { Modal, FuzzySuggestModal } = require("obsidian");
    var { t: t2 } = require_i18n();
    var { inTableCell: inTableCell2 } = require_markdown();
    var SKIP = " skip";
    var MaterializePreviewModal = class extends Modal {
      constructor(app, files, plugin, onApply) {
        super(app);
        this.files = files;
        this.plugin = plugin;
        this.onApply = onApply;
        this.groups = /* @__PURE__ */ new Map();
        for (const fc of files) {
          for (const m of fc.matches) {
            if (!(m.alts && m.alts.length))
              continue;
            const key = m.display.toLowerCase();
            if (!this.groups.has(key))
              this.groups.set(key, { display: m.display, candidates: [m.canonical, ...m.alts], choice: m.canonical, spans: [] });
          }
        }
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: t2("modal.materialize.title") });
        const total = this.files.reduce((n, f) => n + f.matches.length, 0);
        contentEl.createEl("p", { text: t2("modal.materialize.summary", { files: this.files.length, replacements: total }) });
        if (this.groups.size) {
          contentEl.createEl("p", { cls: "glossary-section-desc", text: t2("modal.materialize.ambiguous", { n: this.groups.size }) });
          const panel = contentEl.createDiv({ cls: "glossary-resolve-panel" });
          for (const g of this.groups.values()) {
            const row = panel.createDiv({ cls: "glossary-resolve-row" });
            row.createSpan({ cls: "glossary-resolve-word", text: g.display });
            row.createSpan({ text: "\u2192" });
            const sel = row.createEl("select", { cls: "glossary-term-select" });
            for (const term of g.candidates)
              sel.createEl("option", { text: term, value: term });
            sel.createEl("option", { text: t2("modal.skipOption"), value: SKIP });
            sel.value = g.choice;
            sel.onchange = () => {
              g.choice = sel.value === SKIP ? null : sel.value;
              g.spans.forEach((upd) => upd());
            };
          }
        }
        this.files.forEach((fc) => {
          contentEl.createDiv({ cls: "glossary-preview-file", text: fc.file ? fc.file.path : fc.label || t2("label.selection") });
          const table = contentEl.createEl("table", { cls: "glossary-preview-table" });
          fc.matches.slice(0, 50).forEach((m) => {
            const inTable = inTableCell2(fc.original, m.start);
            const tr = table.createEl("tr");
            tr.createEl("td", { text: m.display });
            tr.createEl("td", { text: "\u2192" });
            const after = tr.createEl("td");
            if (m.alts && m.alts.length) {
              tr.addClass("glossary-ambiguous-row");
              const g = this.groups.get(m.display.toLowerCase());
              const render = () => after.setText(g.choice == null ? t2("modal.leftAsText") : this.plugin.wikiLink(g.choice, m.display, inTable));
              g.spans.push(render);
              render();
            } else {
              after.setText(this.plugin.wikiLink(m.canonical, m.display, inTable));
            }
          });
          if (fc.matches.length > 50)
            contentEl.createEl("div", { cls: "glossary-preview-empty", text: t2("modal.andMore", { n: fc.matches.length - 50 }) });
        });
        const buttons = contentEl.createDiv({ cls: "glossary-preview-buttons" });
        const apply = buttons.createEl("button", { text: t2("btn.apply"), cls: "mod-cta" });
        apply.onclick = async () => {
          const results = this.files.map((fc) => {
            const chosen = [];
            for (const m of fc.matches) {
              if (m.alts && m.alts.length) {
                const g = this.groups.get(m.display.toLowerCase());
                if (!g || g.choice == null)
                  continue;
                chosen.push(g.choice === m.canonical ? m : { ...m, canonical: g.choice });
              } else {
                chosen.push(m);
              }
            }
            const { newText } = this.plugin.applyLinks(fc.original, chosen);
            return { file: fc.file, label: fc.label, original: fc.original, newText, count: chosen.length };
          });
          await this.onApply(results);
          this.close();
        };
        buttons.createEl("button", { text: t2("btn.cancel") }).onclick = () => this.close();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    var HarvestPreviewModal = class extends Modal {
      constructor(app, additions, onApply) {
        super(app);
        this.additions = additions;
        this.onApply = onApply;
        this.checked = /* @__PURE__ */ new Set();
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: t2("modal.harvest.title") });
        const total = this.additions.reduce((n, a) => n + a.aliases.length, 0);
        contentEl.createEl("p", { text: t2("modal.harvest.summary", { terms: this.additions.length, aliases: total }) });
        for (const a of this.additions) {
          contentEl.createDiv({ cls: "glossary-preview-file", text: a.file.basename });
          const list = contentEl.createDiv({ cls: "glossary-harvest-list" });
          for (const al of a.aliases) {
            const collides = al.collidesWith && al.collidesWith.length;
            if (!collides)
              this.checked.add(al);
            const row = list.createDiv({ cls: "glossary-harvest-alias" });
            const label = row.createEl("label");
            const cb = label.createEl("input", { type: "checkbox" });
            cb.checked = !collides;
            cb.onchange = () => {
              if (cb.checked)
                this.checked.add(al);
              else
                this.checked.delete(al);
            };
            label.createSpan({ cls: "glossary-add", text: al.text });
            if (collides) {
              const warn = row.createSpan({ cls: "glossary-collision", text: "\u26A0" });
              warn.setAttribute("aria-label", t2("modal.harvest.alsoMatches", { terms: al.collidesWith.join(", ") }));
            }
          }
          if (a.skipped && a.skipped.length) {
            contentEl.createDiv({ cls: "glossary-section-desc", text: t2("modal.harvest.alreadyPresent", { items: a.skipped.join(", ") }) });
          }
        }
        const buttons = contentEl.createDiv({ cls: "glossary-preview-buttons" });
        const apply = buttons.createEl("button", { text: t2("btn.write"), cls: "mod-cta" });
        apply.onclick = async () => {
          const selected = this.additions.map((a) => ({ file: a.file, aliases: a.aliases.filter((al) => this.checked.has(al)) })).filter((a) => a.aliases.length);
          await this.onApply(selected);
          this.close();
        };
        buttons.createEl("button", { text: t2("btn.cancel") }).onclick = () => this.close();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    var UnlinkPreviewModal = class extends Modal {
      constructor(app, files, plugin, onApply) {
        super(app);
        this.files = files;
        this.plugin = plugin;
        this.onApply = onApply;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: t2("modal.unlink.title") });
        const total = this.files.reduce((n, f) => n + f.matches.length, 0);
        contentEl.createEl("p", { text: t2("modal.unlink.summary", { files: this.files.length, links: total }) });
        this.files.forEach((fc) => {
          contentEl.createDiv({ cls: "glossary-preview-file", text: fc.file ? fc.file.path : fc.label || t2("label.selection") });
          const table = contentEl.createEl("table", { cls: "glossary-preview-table" });
          fc.matches.slice(0, 50).forEach((m) => {
            const tr = table.createEl("tr");
            tr.createEl("td", { text: m.source });
            tr.createEl("td", { text: "\u2192" });
            tr.createEl("td", { text: m.display });
          });
          if (fc.matches.length > 50)
            contentEl.createEl("div", { cls: "glossary-preview-empty", text: t2("modal.andMore", { n: fc.matches.length - 50 }) });
        });
        const buttons = contentEl.createDiv({ cls: "glossary-preview-buttons" });
        const apply = buttons.createEl("button", { text: t2("btn.apply"), cls: "mod-cta" });
        apply.onclick = async () => {
          const results = this.files.map((fc) => {
            const { newText, count } = this.plugin.unlinkLinks(fc.original, fc.matches);
            return { file: fc.file, label: fc.label, original: fc.original, newText, count };
          });
          await this.onApply(results);
          this.close();
        };
        buttons.createEl("button", { text: t2("btn.cancel") }).onclick = () => this.close();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    var ChooseTermModal = class extends Modal {
      constructor(app, opts) {
        super(app);
        this.opts = opts;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: this.opts.title || t2("modal.choose.title") });
        contentEl.createEl("p", { text: t2("modal.choose.body") });
        const list = contentEl.createDiv({ cls: "glossary-choose-list" });
        for (const term of this.opts.terms) {
          const foreign = term && typeof term === "object";
          const b = list.createEl("button", { cls: "glossary-choose-item", text: foreign ? term.label : term });
          b.onclick = async () => {
            this.close();
            if (foreign)
              term.open();
            else
              await this.opts.onChoose(term);
          };
        }
        contentEl.createDiv({ cls: "glossary-preview-buttons" }).createEl("button", { text: t2("btn.cancel") }).onclick = () => this.close();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    var TermPickerModal = class extends FuzzySuggestModal {
      constructor(app, terms, onChoose) {
        super(app);
        this.terms = terms;
        this.onChoose = onChoose;
        this.setPlaceholder(t2("modal.alias.pickTerm"));
      }
      getItems() {
        return this.terms;
      }
      getItemText(item) {
        return item.canonical;
      }
      onChooseItem(item) {
        this.onChoose(item);
      }
    };
    var AliasTextModal = class extends Modal {
      constructor(app, termName, onSubmit) {
        super(app);
        this.termName = termName;
        this.onSubmit = onSubmit;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: t2("modal.alias.title", { term: this.termName }) });
        contentEl.createEl("p", { cls: "glossary-section-desc", text: t2("modal.alias.body") });
        const input = contentEl.createEl("input", { type: "text", cls: "glossary-alias-input" });
        const submit = () => {
          const v = input.value.trim();
          if (v) {
            this.onSubmit(v);
            this.close();
          }
        };
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter")
            submit();
        });
        const buttons = contentEl.createDiv({ cls: "glossary-preview-buttons" });
        buttons.createEl("button", { text: t2("btn.write"), cls: "mod-cta" }).onclick = submit;
        buttons.createEl("button", { text: t2("btn.cancel") }).onclick = () => this.close();
        input.focus();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = {
      MaterializePreviewModal,
      HarvestPreviewModal,
      ChooseTermModal,
      UnlinkPreviewModal,
      TermPickerModal,
      AliasTextModal
    };
  }
});

// src/actions.js
var require_actions = __commonJS({
  "src/actions.js"(exports2, module2) {
    "use strict";
    var { Notice: Notice2, TFile: TFile2, moment } = require("obsidian");
    var { splitLines: splitLines2 } = require_markdown();
    var {
      MaterializePreviewModal,
      HarvestPreviewModal,
      ChooseTermModal,
      UnlinkPreviewModal,
      TermPickerModal,
      AliasTextModal
    } = require_modals();
    var { candidatesFor } = require_discover();
    var { t: t2, plural: plural2 } = require_i18n();
    module2.exports = {
      // Ambiguous matches keep their `alts` so the preview can let the user pick a term.
      collectMatches(text, currentCanonical) {
        const matches = this.findMatches(text, currentCanonical, { protect: true });
        if (!this.settings.linkFirstOnly)
          return matches;
        const seen = /* @__PURE__ */ new Set();
        const out = [];
        for (const m of matches) {
          if (seen.has(m.canonical))
            continue;
          seen.add(m.canonical);
          out.push(m);
        }
        return out;
      },
      openMaterializePreview(files, onApply) {
        new MaterializePreviewModal(this.app, files, this, onApply).open();
      },
      // Write each result, skipping notes edited since the preview was built.
      async writeScopeResults(results) {
        let total = 0;
        let skipped = 0;
        for (const r of results) {
          let written = false;
          await this.app.vault.process(r.file, (data) => {
            if (data !== r.original)
              return data;
            written = true;
            return r.newText;
          });
          if (written)
            total += r.count;
          else
            skipped++;
        }
        let msg = t2("notice.scopeWritten", { files: plural2("file", results.length - skipped), links: plural2("link", total) });
        if (skipped)
          msg += t2("notice.scopeSkipped", { n: skipped });
        new Notice2(msg);
        this.updateStatusBar();
      },
      async materializeCurrent() {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice2(t2("notice.noActiveNote"));
          return;
        }
        const text = await this.app.vault.cachedRead(file);
        const matches = this.collectMatches(text, this.canonicalForPath(file.path));
        if (!matches.length) {
          new Notice2(t2("notice.noMatches"));
          return;
        }
        this.openMaterializePreview([{ file, original: text, matches }], async (results) => {
          const r = results[0];
          let written = false;
          await this.app.vault.process(r.file, (data) => {
            if (data !== r.original)
              return data;
            written = true;
            return r.newText;
          });
          if (!written) {
            new Notice2(t2("notice.noteChanged"));
            return;
          }
          new Notice2(t2("notice.linksCreated", { links: plural2("link", r.count) }));
          this.updateStatusBar();
        });
      },
      materializeSelection(editor) {
        const sel = editor.getSelection();
        if (!sel) {
          new Notice2(t2("notice.noSelection"));
          return;
        }
        const file = this.app.workspace.getActiveFile();
        const matches = this.collectMatches(sel, file ? this.canonicalForPath(file.path) : null);
        if (!matches.length) {
          new Notice2(t2("notice.noMatches"));
          return;
        }
        this.openMaterializePreview([{ file: null, original: sel, matches, label: t2("label.selection") }], (results) => {
          editor.replaceSelection(results[0].newText);
          new Notice2(t2("notice.linksCreated", { links: plural2("link", results[0].count) }));
        });
      },
      async scanScopeMatches(compute) {
        const files = this.getScopeFiles();
        const out = [];
        const notice = new Notice2(t2("notice.scanning"), 0);
        try {
          for (let i = 0; i < files.length; i++) {
            if (i % 25 === 0)
              notice.setMessage(t2("notice.scanningProgress", { current: i + 1, total: files.length }));
            const file = files[i];
            const text = await this.app.vault.cachedRead(file);
            const matches = compute(text, file);
            if (matches.length)
              out.push({ file, original: text, matches });
          }
        } finally {
          notice.hide();
        }
        return out;
      },
      async materializeScope() {
        const files = await this.scanScopeMatches((text, file) => this.collectMatches(text, this.canonicalForPath(file.path)));
        if (!files.length) {
          new Notice2(t2("notice.noMatches"));
          return;
        }
        this.openMaterializePreview(files, (results) => this.writeScopeResults(results));
      },
      // Glossary wikilinks in `text` that unlink can revert: each resolves to a glossary note,
      // sits outside code/frontmatter, and isn't a #subpath link (those are deliberate — reverting
      // would drop the anchor). Offsets are into `text`.
      findGlossaryLinks(text, sourcePath) {
        const ranges = this.codeFrontmatterRanges(text);
        const re = /\[\[([^\]\n]+)\]\]/g;
        const out = [];
        let m;
        while ((m = re.exec(text)) !== null) {
          const start = m.index;
          const end = m.index + m[0].length;
          if (this.overlapsProtected(ranges, start, end))
            continue;
          const { target, display, hasSubpath } = this.parseWikiInner(m[1]);
          if (!target || !display || hasSubpath)
            continue;
          const dest = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath || "");
          if (!dest || !this.isGlossaryFile(dest))
            continue;
          out.push({ start, end, canonical: dest.basename, display, source: m[0] });
        }
        return out;
      },
      openUnlinkPreview(files, onApply) {
        new UnlinkPreviewModal(this.app, files, this, onApply).open();
      },
      async unlinkCurrent() {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice2(t2("notice.noActiveNote"));
          return;
        }
        const text = await this.app.vault.cachedRead(file);
        const links = this.findGlossaryLinks(text, file.path);
        if (!links.length) {
          new Notice2(t2("notice.noGlossaryLinks"));
          return;
        }
        this.openUnlinkPreview([{ file, original: text, matches: links }], (results) => this.writeScopeResults(results));
      },
      unlinkSelection(editor) {
        const sel = editor.getSelection();
        if (!sel) {
          new Notice2(t2("notice.noSelection"));
          return;
        }
        const file = this.app.workspace.getActiveFile();
        const links = this.findGlossaryLinks(sel, file ? file.path : "");
        if (!links.length) {
          new Notice2(t2("notice.noGlossaryLinks"));
          return;
        }
        this.openUnlinkPreview([{ file: null, original: sel, matches: links, label: t2("label.selection") }], (results) => {
          editor.replaceSelection(results[0].newText);
          new Notice2(t2("notice.linksRemoved", { links: plural2("link", results[0].count) }));
        });
      },
      async unlinkScope() {
        const files = await this.scanScopeMatches((text, file) => this.findGlossaryLinks(text, file.path));
        if (!files.length) {
          new Notice2(t2("notice.noGlossaryLinks"));
          return;
        }
        this.openUnlinkPreview(files, (results) => this.writeScopeResults(results));
      },
      async createTermFromSelection(editor, replaceWithLink) {
        var _a;
        const sel = (editor.getSelection() || "").trim();
        if (!sel) {
          new Notice2(t2("notice.nothingSelected"));
          return;
        }
        if (this.settings.aliasCollisionWarnings) {
          const hits = this.termsMatchingText(sel);
          if (hits.length) {
            const sourcePath = ((_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path) || "";
            this.openTerm(hits[0], sourcePath, false);
            new Notice2(t2("notice.alreadyMatchesOpened", { sel, term: hits[0] }));
            return;
          }
        }
        return this.createTermNote(editor, sel, replaceWithLink);
      },
      async createTermNote(editor, sel, replaceWithLink) {
        const name = sel.replace(/[\\/:*?"<>|#^\[\]]/g, "").replace(/\s+/g, " ").trim();
        if (!name) {
          new Notice2(t2("notice.invalidTermName"));
          return;
        }
        await this.ensureGlossaryFolder();
        const folder = this.settings.glossaryFolder.replace(/\/+$/, "");
        const path = folder ? `${folder}/${name}.md` : `${name}.md`;
        let file = this.app.vault.getAbstractFileByPath(path);
        if (file) {
          new Notice2(t2("notice.termExists", { name }));
        } else {
          try {
            const content = await this.buildTermContent(name, sel);
            file = await this.app.vault.create(path, content);
          } catch (e) {
            new Notice2(t2("notice.couldNotCreate"));
            return;
          }
        }
        if (replaceWithLink)
          editor.replaceSelection(this.wikiLink(name, sel));
        this.rebuildIndex();
        this.updateStatusBar();
        await this.app.workspace.getLeaf("tab").openFile(file);
      },
      async buildTermContent(name, sel) {
        const tplPath = (this.settings.termTemplate || "").trim();
        if (!tplPath)
          return "";
        const tpl = this.app.vault.getAbstractFileByPath(tplPath);
        if (!(tpl instanceof TFile2)) {
          new Notice2(t2("notice.templateNotFound", { path: tplPath }));
          return "";
        }
        let text;
        try {
          text = await this.app.vault.read(tpl);
        } catch (e) {
          new Notice2(t2("notice.couldNotReadTemplate"));
          return "";
        }
        return this.applyTermPlaceholders(text, name, sel);
      },
      applyTermPlaceholders(text, name, sel) {
        const src = this.app.workspace.getActiveFile();
        const m = (() => {
          try {
            return moment ? moment() : null;
          } catch (e) {
            return null;
          }
        })();
        const fmt = (f, fallback) => m ? m.format(f) : fallback();
        return text.replace(/\{\{\s*title\s*\}\}/g, name).replace(/\{\{\s*selection\s*\}\}/g, sel).replace(/\{\{\s*source\s*\}\}/g, src ? src.basename : "").replace(/\{\{\s*sourcePath\s*\}\}/g, src ? src.path : "").replace(/\{\{\s*date(?::([^}]*))?\s*\}\}/g, (_, f) => fmt((f || "YYYY-MM-DD").trim(), () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10))).replace(/\{\{\s*time(?::([^}]*))?\s*\}\}/g, (_, f) => fmt((f || "HH:mm").trim(), () => (/* @__PURE__ */ new Date()).toTimeString().slice(0, 5)));
      },
      // The highlighted (not yet linked) match under the cursor, with whatever the other
      // linkers would offer at the same spot, or null.
      //
      // It runs through ownSpans, so on a word several linkers know only the owner finds
      // anything here — which is what keeps one "Link…" item in the menu instead of one per
      // plugin. The others stay quiet and their readings ride along as candidates.
      matchAtCursor(editor) {
        const head = editor.getCursor("head");
        const line = editor.getLine(head.line);
        if (!line)
          return null;
        const matches = this.ownSpans(line, this.findMatches(line, this.activeCanonical(), { protect: true }));
        const hit = matches.find((m) => head.ch >= m.start && head.ch <= m.end);
        if (!hit)
          return null;
        const foreign = candidatesFor(this.yieldedIn(line), hit.start, hit.end);
        return { match: hit, foreign, line: head.line };
      },
      // The match under the cursor as we see it, ownership aside — so null only when this word
      // means nothing to us at all.
      //
      // Used for excluding a word, and only for that. Excluding is a setting of *this* plugin:
      // it stops us matching the word and says nothing about what the sibling does. Gating it on
      // ownership hid it exactly where it is most wanted — on a word both linkers match, where
      // the loser is drawing nothing yet still matches, and the settings tab was the only way
      // left to tell it to stop.
      wordAtCursor(editor) {
        const head = editor.getCursor("head");
        const line = editor.getLine(head.line);
        if (!line)
          return null;
        const matches = this.findMatches(line, this.activeCanonical(), { protect: true });
        return matches.find((m) => head.ch >= m.start && head.ch <= m.end) || null;
      },
      // Every reading of the match under the cursor: ours, our own same-named alternatives, and
      // the ones other linkers stood down on. What the menu offers to link or open.
      cursorCandidates(hit, sourcePath, newTab) {
        const own = [hit.match.canonical, ...hit.match.alts || []];
        const foreign = hit.foreign.map((c) => ({ ...c, open: () => c.open(sourcePath, newTab) }));
        return [...own, ...foreign];
      },
      chooseTerm(candidates, title, action) {
        const list = (candidates || []).filter(Boolean);
        if (list.length <= 1) {
          const only = list[0];
          if (only && typeof only === "object")
            return only.open();
          return action(only);
        }
        new ChooseTermModal(this.app, { title, terms: list, onChoose: action }).open();
      },
      isExcluded(listKey, value) {
        const v = value.toLowerCase();
        return splitLines2(this.settings[listKey]).some((l) => l.toLowerCase() === v);
      },
      // Add or remove exclusion item for `menu`, toggled by current state. A prefix (native menus)
      // selects the brand-prefixed lower-case wording; without it (the plugin's own menu) the
      // capitalised wording is used. excludeWords are stored lowercased.
      addExclusionMenuItem(menu, listKey, value, prefix = "") {
        const noun = listKey === "excludeWords" ? t2("exclude.words") : t2("exclude.terms");
        if (this.isExcluded(listKey, value)) {
          menu.addItem((i) => i.setTitle(t2(prefix ? "exclude.removePrefixed" : "exclude.remove", { value, noun })).setIcon("rotate-ccw").onClick(() => this.removeFromExclusion(listKey, value)));
        } else {
          const icon = listKey === "excludeWords" ? "ban" : "trash-2";
          const stored = listKey === "excludeWords" ? value.toLowerCase() : value;
          menu.addItem((i) => i.setTitle(t2(prefix ? "exclude.addPrefixed" : "exclude.add", { value, noun })).setIcon(icon).onClick(() => this.addToExclusion(listKey, stored)));
        }
      },
      async addToExclusion(listKey, value) {
        const lines = splitLines2(this.settings[listKey]);
        if (lines.some((l) => l.toLowerCase() === value.toLowerCase())) {
          new Notice2(t2("notice.alreadyExcluded", { value }));
          return;
        }
        lines.push(value);
        this.settings[listKey] = lines.join("\n");
        await this.saveSettings();
        this.rebuildIndex();
        this.rerenderViews();
        this.updateStatusBar();
        const where = listKey === "excludeWords" ? t2("exclude.words") : t2("exclude.terms");
        new Notice2(t2("notice.addedToExcluded", { value, where }));
      },
      async removeFromExclusion(listKey, value) {
        const v = value.toLowerCase();
        const lines = splitLines2(this.settings[listKey]);
        const kept = lines.filter((l) => l.toLowerCase() !== v);
        if (kept.length === lines.length) {
          new Notice2(t2("notice.wasNotExcluded", { value }));
          return;
        }
        this.settings[listKey] = kept.join("\n");
        await this.saveSettings();
        this.rebuildIndex();
        this.rerenderViews();
        this.updateStatusBar();
        const where = listKey === "excludeWords" ? t2("exclude.words") : t2("exclude.terms");
        new Notice2(t2("notice.removedFromExcluded", { value, where }));
      },
      // linkAs (optional) overrides which term the occurrence is linked to — used when
      // a word matches several terms and the user picks an alternative from the menu.
      async materializeSingle(file, canonical, display, nearOffset, occurrence, linkAs) {
        let created = false;
        await this.app.vault.process(file, (text) => {
          const matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true }).filter((m) => m.canonical === canonical && m.display === display);
          if (!matches.length)
            return text;
          let target = matches[0];
          if (occurrence != null && matches[occurrence]) {
            target = matches[occurrence];
          } else if (nearOffset != null) {
            target = matches.reduce((best, m) => Math.abs(m.start - nearOffset) < Math.abs(best.start - nearOffset) ? m : best, matches[0]);
          }
          const chosen = linkAs && linkAs !== target.canonical ? { ...target, canonical: linkAs } : target;
          created = true;
          return this.applyLinks(text, [chosen]).newText;
        });
        if (!created) {
          new Notice2(t2("notice.occurrenceNotFound"));
          return;
        }
        new Notice2(t2("notice.linkCreatedSingle"));
        this.updateStatusBar();
      },
      // linkAs (optional) links the matched occurrences to a chosen alternative term
      // instead of the one findMatches picked (used to resolve an alias collision).
      async materializeTerm(file, canonical, linkAs) {
        let count = 0;
        await this.app.vault.process(file, (text) => {
          let matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true }).filter((m) => m.canonical === canonical);
          if (!matches.length)
            return text;
          if (this.settings.linkFirstOnly)
            matches = matches.slice(0, 1);
          if (linkAs && linkAs !== canonical)
            matches = matches.map((m) => ({ ...m, canonical: linkAs }));
          count = matches.length;
          return this.applyLinks(text, matches).newText;
        });
        if (!count) {
          new Notice2(t2("notice.noOccurrences"));
          return;
        }
        new Notice2(t2("notice.linksCreated", { links: plural2("link", count) }));
        this.updateStatusBar();
      },
      async materializeTermScope(canonical, linkAs) {
        const term = linkAs || canonical;
        const files = await this.scanScopeMatches((text, file) => {
          let matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true }).filter((m) => m.canonical === canonical);
          if (this.settings.linkFirstOnly)
            matches = matches.slice(0, 1);
          return matches.map((m) => ({ ...m, canonical: term, alts: null }));
        });
        if (!files.length) {
          new Notice2(t2("notice.noOccurrences"));
          return;
        }
        this.openMaterializePreview(files, (results) => this.writeScopeResults(results));
      },
      termLiterals(file) {
        const out = /* @__PURE__ */ new Set();
        for (const form of [file.basename, ...this.aliasesOf(file)]) {
          if (typeof form === "string" && form.trim())
            out.add(form.toLowerCase());
        }
        return out;
      },
      // Obsidian keeps inline markup in displayText; drop it so `code`/*em* doesn't reach an alias.
      // Returns '' (skip the link) when no letters survive.
      normalizeDisplay(display) {
        if (typeof display !== "string")
          return "";
        const clean = display.replace(/[`*_~]/g, "").replace(/\s+/g, " ").trim();
        return /\p{L}/u.test(clean) ? clean : "";
      },
      partialOfMultiwordTitle(file, cand) {
        const words = this.tokenizeForm(file.basename);
        if (words.length < 2)
          return false;
        const keys = this.keysFor(cand);
        return words.some((w) => w.keys.some((k) => keys.includes(k)));
      },
      harvestCandidates(display) {
        if (this.settings.harvestSingleWordOnly && this.tokenizeForm(display).length > 1)
          return [];
        const lower = display.toLowerCase();
        const out = [];
        const mode = this.settings.aliasHarvestMode;
        if (mode === "literal" || mode === "both")
          out.push(lower);
        if (mode === "lemma" || mode === "both")
          out.push(this.lemmaFor(display));
        const min = Math.max(1, this.settings.harvestMinLength || 1);
        return [...new Set(out)].filter((a) => a && a.length >= min);
      },
      // Fills `add` (cand → collidesWith) and `skip` from one link's display. Shared by both harvest paths.
      collectAliasesFromDisplay(file, display, literals, add, skip) {
        if (this.termsMatchingText(display).includes(file.basename))
          return;
        for (const cand of this.harvestCandidates(display)) {
          if (add.has(cand))
            continue;
          if (literals.has(cand)) {
            skip.add(cand);
            continue;
          }
          if (this.partialOfMultiwordTitle(file, cand)) {
            skip.add(cand);
            continue;
          }
          add.set(cand, this.settings.aliasCollisionWarnings ? this.termsMatchingText(cand, file.basename) : []);
        }
      },
      async harvestFiles(files, silent) {
        const perTerm = /* @__PURE__ */ new Map();
        for (const file of files) {
          const cache = this.app.metadataCache.getFileCache(file);
          if (!cache || !cache.links)
            continue;
          for (const link of cache.links) {
            const display = this.normalizeDisplay(link.displayText);
            if (!display)
              continue;
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
            if (!targetFile || !this.isGlossaryFile(targetFile))
              continue;
            if (display.toLowerCase() === targetFile.basename.toLowerCase())
              continue;
            let entry = perTerm.get(targetFile.path);
            if (!entry) {
              entry = { file: targetFile, add: /* @__PURE__ */ new Map(), skip: /* @__PURE__ */ new Set(), literals: this.termLiterals(targetFile) };
              perTerm.set(targetFile.path, entry);
            }
            this.collectAliasesFromDisplay(targetFile, display, entry.literals, entry.add, entry.skip);
          }
        }
        const additions = [];
        for (const entry of perTerm.values()) {
          let chosen = [...entry.add.entries()];
          if (silent)
            chosen = chosen.filter(([, collidesWith]) => !collidesWith.length);
          if (!chosen.length)
            continue;
          const aliases = chosen.map(([text, collidesWith]) => ({ text, collidesWith }));
          additions.push({ file: entry.file, aliases, skipped: [...entry.skip] });
        }
        if (!additions.length) {
          if (!silent)
            new Notice2(t2("notice.noNewAliases"));
          return;
        }
        if (silent) {
          await this.applyHarvest(additions);
          return;
        }
        new HarvestPreviewModal(this.app, additions, (selected) => this.applyHarvest(selected)).open();
      },
      async applyHarvest(selected) {
        await this.ensureGlossaryFolder();
        let total = 0;
        for (const a of selected) {
          await this.app.fileManager.processFrontMatter(a.file, (fm) => {
            let list = fm.aliases;
            if (!Array.isArray(list))
              list = typeof list === "string" && list.trim() ? [list] : [];
            const existing = new Set(list.map((x) => String(x).toLowerCase()));
            for (const al of a.aliases) {
              const text = typeof al === "string" ? al : al.text;
              if (!existing.has(text.toLowerCase())) {
                list.push(text);
                existing.add(text.toLowerCase());
                total++;
              }
            }
            fm.aliases = list;
          });
        }
        this.rebuildIndex();
        this.updateStatusBar();
        new Notice2(t2("notice.aliasesAdded", { aliases: plural2("alias", total) }));
      },
      // Collect just one link's wording as an alias for its term — the per-link version of
      // harvestFiles, reusing the same candidate rules, collision check and preview/apply.
      async harvestOneLink(targetFile, rawDisplay) {
        const display = this.normalizeDisplay(rawDisplay);
        if (!targetFile || !this.isGlossaryFile(targetFile) || !display)
          return;
        if (display.toLowerCase() === targetFile.basename.toLowerCase()) {
          new Notice2(t2("notice.wordingMatchesTerm"));
          return;
        }
        const add = /* @__PURE__ */ new Map();
        const skip = /* @__PURE__ */ new Set();
        this.collectAliasesFromDisplay(targetFile, display, this.termLiterals(targetFile), add, skip);
        if (!add.size) {
          new Notice2(t2("notice.noNewAlias"));
          return;
        }
        const aliases = [...add.entries()].map(([text, collidesWith]) => ({ text, collidesWith }));
        const additions = [{ file: targetFile, aliases, skipped: [...skip] }];
        new HarvestPreviewModal(this.app, additions, (selected) => this.applyHarvest(selected)).open();
      },
      // Shared write: attach `alias` as a plain alias on `term` (from this.terms).
      // For forms the stemmer can't derive from the title (abbreviations, synonyms,
      // alternate spellings), which must be listed explicitly to be matched.
      async writeAlias(term, alias) {
        const file = this.app.vault.getAbstractFileByPath(term.path);
        if (!(file instanceof TFile2)) {
          new Notice2(t2("notice.termFileMissing", { term: term.canonical }));
          return;
        }
        const already = (this.aliasesOf(file) || []).some((a) => a.toLowerCase() === alias.toLowerCase());
        if (already || alias.toLowerCase() === term.canonical.toLowerCase()) {
          new Notice2(t2("notice.aliasExists", { alias, term: term.canonical }));
          return;
        }
        const collidesWith = [...this.termsMatchingText(alias)].filter((c) => c !== term.canonical);
        await this.app.fileManager.processFrontMatter(file, (fm) => {
          let list = fm.aliases;
          if (!Array.isArray(list))
            list = typeof list === "string" && list.trim() ? [list] : [];
          list.push(alias);
          fm.aliases = list;
        });
        this.rebuildIndex();
        this.updateStatusBar();
        if (collidesWith.length) {
          new Notice2(t2("notice.aliasAddedCollision", { alias, term: term.canonical, others: collidesWith.join(", ") }));
        } else {
          new Notice2(t2("notice.aliasAdded", { alias, term: term.canonical }));
        }
      },
      // Command Palette flow: pick a term, then type the alias.
      addAlias() {
        if (!this.terms || !this.terms.length) {
          new Notice2(t2("notice.noTerms"));
          return;
        }
        new TermPickerModal(this.app, this.terms, (term) => {
          new AliasTextModal(this.app, term.canonical, (alias) => this.writeAlias(term, alias)).open();
        }).open();
      },
      // Editor context-menu flow: the selection already IS the alias, so only
      // the term still needs picking.
      addAliasFromSelection(alias) {
        if (!this.terms || !this.terms.length) {
          new Notice2(t2("notice.noTerms"));
          return;
        }
        new TermPickerModal(this.app, this.terms, (term) => this.writeAlias(term, alias)).open();
      }
    };
  }
});

// src/shared/prose/suggest.js
var require_suggest = __commonJS({
  "src/shared/prose/suggest.js"(exports2, module2) {
    "use strict";
    var { peerSuggestions } = require_discover();
    function mergeSuggestions(plugin, query, own, limit = 8) {
      const provider = plugin.api && plugin.api.linker;
      if (!provider)
        return own;
      const foreign = peerSuggestions(plugin.app, provider, query);
      if (!foreign.length)
        return own;
      const mine = provider.precedence || 0;
      const above = foreign.filter((f) => f.precedence > mine);
      const below = foreign.filter((f) => f.precedence <= mine);
      return [...above, ...own, ...below].slice(0, limit);
    }
    module2.exports = { mergeSuggestions };
  }
});

// src/shared/prose/editor-suggest.js
var require_editor_suggest = __commonJS({
  "src/shared/prose/editor-suggest.js"(exports2, module2) {
    "use strict";
    var { EditorSuggest } = require("obsidian");
    var { inTableCell: inTableCell2 } = require_markdown();
    var { mergeSuggestions } = require_suggest();
    function createProseSuggest(config) {
      const { cls, ownId, collect, noteFor, labelOf, targetOf, displayFor } = config;
      return class ProseSuggest extends EditorSuggest {
        constructor(app, plugin) {
          super(app);
          this.plugin = plugin;
        }
        onTrigger(cursor, editor, file) {
          const plugin = this.plugin;
          if (!plugin.settings.linkSuggest)
            return null;
          if (!file || !plugin.inScope(file.path))
            return null;
          const line = editor.getLine(cursor.line);
          if (/[\p{L}\p{Nd}]/u.test(line[cursor.ch] || ""))
            return null;
          const m = line.slice(0, cursor.ch).match(/[\p{L}\p{Nd}]+$/u);
          if (!m)
            return null;
          const query = m[0];
          if (query.length < Math.max(1, plugin.settings.suggestMinChars || 1))
            return null;
          const before = line[cursor.ch - query.length - 1] || "";
          if (before && (plugin.settings.suggestSkipAfter || "").includes(before))
            return null;
          const off = editor.posToOffset(cursor);
          if (plugin.isProtectedAt(editor.getValue(), off))
            return null;
          const items = this.merged(query);
          if (!items.length)
            return null;
          this.cached = { query, items };
          return { start: { line: cursor.line, ch: cursor.ch - query.length }, end: cursor, query };
        }
        // Ours plus every sibling linker's, in one list.
        merged(query) {
          return mergeSuggestions(this.plugin, query, collect(this.plugin, query, ownId(this.plugin)));
        }
        getSuggestions(context) {
          if (this.cached && this.cached.query === context.query)
            return this.cached.items;
          return this.merged(context.query);
        }
        renderSuggestion(item, el) {
          el.addClass(`${cls}-suggestion`);
          el.createSpan({ cls: `${cls}-suggestion-title`, text: item.insert ? item.label : labelOf(item) });
          const note = item.insert ? item.note : noteFor(item);
          if (note)
            el.createSpan({ cls: `${cls}-suggestion-note`, text: note });
        }
        selectSuggestion(item) {
          const ctx = this.context;
          if (!ctx)
            return;
          const editor = ctx.editor;
          const inTable = inTableCell2(editor.getValue(), editor.posToOffset(ctx.start));
          const link = item.insert ? item.insert(item.display == null ? ctx.query : item.display, inTable) : this.plugin.wikiLink(targetOf(item), displayFor(item, ctx.query), inTable);
          if (!link)
            return;
          editor.replaceRange(link, ctx.start, ctx.end);
          editor.setCursor(editor.offsetToPos(editor.posToOffset(ctx.start) + link.length));
        }
      };
    }
    var suggestAvailable2 = () => typeof EditorSuggest === "function";
    module2.exports = { createProseSuggest, suggestAvailable: suggestAvailable2 };
  }
});

// src/term-suggest.js
var require_term_suggest = __commonJS({
  "src/term-suggest.js"(exports2, module2) {
    "use strict";
    var { t: t2 } = require_i18n();
    var { createProseSuggest, suggestAvailable: suggestAvailable2 } = require_editor_suggest();
    function collectSuggestions(plugin, query, ownCanonical) {
      const qLower = query.toLowerCase();
      const byCanonical = /* @__PURE__ */ new Map();
      const seenCand = /* @__PURE__ */ new Set();
      for (const key of plugin.keysFor(query)) {
        const bucket = plugin.index.byKey.get(key);
        if (!bucket)
          continue;
        for (const c of bucket) {
          if (c.wordCount !== 1 || seenCand.has(c) || c.canonical === ownCanonical)
            continue;
          seenCand.add(c);
          if (!byCanonical.has(c.canonical))
            byCanonical.set(c.canonical, { canonical: c.canonical, matchedForm: c.canonical, kind: "form" });
        }
      }
      for (const t3 of plugin.terms || []) {
        if (byCanonical.has(t3.canonical) || t3.canonical === ownCanonical)
          continue;
        let form = null;
        if (t3.canonical.toLowerCase().startsWith(qLower))
          form = t3.canonical;
        else {
          const a = t3.aliases.find((al) => al.toLowerCase().startsWith(qLower));
          if (a)
            form = a;
        }
        if (form)
          byCanonical.set(t3.canonical, { canonical: t3.canonical, matchedForm: form, kind: "prefix" });
      }
      const items = [...byCanonical.values()];
      const rank = (it) => it.kind === "form" ? 0 : 1;
      items.sort((a, b) => rank(a) - rank(b) || a.matchedForm.length - b.matchedForm.length || a.canonical.localeCompare(b.canonical));
      return items.slice(0, 8);
    }
    function noteFor(item) {
      if (item.kind === "form")
        return t2("suggest.inflection");
      if (item.matchedForm !== item.canonical)
        return t2("suggest.alias", { form: item.matchedForm });
      return "";
    }
    function suggestionsFor(plugin, query) {
      return collectSuggestions(plugin, query, plugin.activeCanonical()).map((it) => ({
        label: it.canonical,
        note: noteFor(it),
        target: it.canonical,
        display: it.kind === "form" ? null : it.canonical
      }));
    }
    var GlossaryTermSuggest2 = createProseSuggest({
      cls: "glossary",
      // A term's own note does not offer that term. In folder mode inScope already rules the
      // note out; in whole-vault mode every note is a term source, so the candidate set is what
      // has to drop it — the same exclusion the highlighter makes.
      ownId: (plugin) => plugin.activeCanonical(),
      collect: collectSuggestions,
      noteFor,
      labelOf: (it) => it.canonical,
      targetOf: (it) => it.canonical,
      // 'form' keeps the typed wording; 'prefix' completes to the term title.
      displayFor: (it, query) => it.kind === "form" ? query : it.canonical
    });
    module2.exports = { GlossaryTermSuggest: GlossaryTermSuggest2, suggestAvailable: suggestAvailable2, collectSuggestions, suggestionsFor };
  }
});

// src/api.js
var require_api = __commonJS({
  "src/api.js"(exports2, module2) {
    "use strict";
    var { Notice: Notice2 } = require("obsidian");
    var { t: t2 } = require_i18n();
    var { LINKER_API } = require_discover();
    var { suggestionsFor } = require_term_suggest();
    module2.exports = {
      buildApi() {
        const plugin = this;
        return {
          version: this.manifest.version,
          // Every indexed term: { canonical, path, aliases }.
          getTerms: () => this.getTerms(),
          // Resolve a title or alias (case-insensitive) to its term, or null.
          resolveTerm: (name) => this.resolveTerm(name),
          // Morphology helpers (same engine the matcher uses).
          keysFor: (word) => this.keysFor(String(word || "")),
          lemmaFor: (word) => this.lemmaFor(String(word || "")),
          // Glossary matches in arbitrary text, skipping protected ranges.
          findMatches: (text) => this.findMatches(String(text || ""), null, { protect: true }),
          // Heavy: scans in-scope notes and counts occurrences per term. Call explicitly.
          getUsageReport: (opts) => this.getUsageReport(opts),
          // Heavy: frequent in-scope words that are not yet terms. Call explicitly.
          collectCandidates: (opts) => this.collectCandidates(opts),
          // Subscribe to index rebuilds; returns an unsubscribe function.
          onChange: (cb) => this.onIndexChange(cb),
          // The provider contract the sibling linkers read (consumed in shared/discover.js).
          linker: {
            apiVersion: LINKER_API,
            id: "glossary-linker",
            displayName: "Glossary Linker",
            kind: "prose",
            // A getter, so a settings change is seen without rebuilding the api object.
            get precedence() {
              return plugin.settings.linkPrecedence;
            },
            // Protected ranges are skipped, so the answer matches what we would decorate.
            matches: (text) => plugin.findMatches(String(text || ""), null, { protect: true }).map((m) => ({ start: m.start, end: m.end, label: m.canonical, target: m.canonical })),
            open: (target, sourcePath, newTab) => plugin.openTerm(target, sourcePath, newTab),
            // Our own preview of one of our targets, anchored to someone else's element.
            hover: (target, event, targetEl, sourcePath, hoverParent) => plugin.hoverTerm(event, targetEl, target, sourcePath, hoverParent),
            suggest: (query) => suggestionsFor(plugin, String(query || "")),
            // The popup's owner writes our link text but never composes it.
            linkFor: (target, display, inTable) => plugin.wikiLink(target, display, inTable),
            refresh: () => plugin.rerenderViews()
          }
        };
      },
      getTerms() {
        return (this.terms || []).map((t3) => ({ canonical: t3.canonical, path: t3.path, aliases: t3.aliases.slice() }));
      },
      resolveTerm(name) {
        if (!name)
          return null;
        const q = String(name).toLowerCase();
        for (const t3 of this.terms || []) {
          if (t3.canonical.toLowerCase() === q)
            return { canonical: t3.canonical, path: t3.path, aliases: t3.aliases.slice() };
          if (t3.aliases.some((a) => a.toLowerCase() === q))
            return { canonical: t3.canonical, path: t3.path, aliases: t3.aliases.slice() };
        }
        return null;
      },
      // For every term, how many times it is used across in-scope notes and in which
      // files. Counts plain-text mentions; with opts.includeLinks, also direct
      // [[Term]] / [[Term|alias]] links. Terms with count 0 are orphans.
      async getUsageReport(opts = {}) {
        const counts = /* @__PURE__ */ new Map();
        for (const t3 of this.terms || [])
          counts.set(t3.canonical, { canonical: t3.canonical, path: t3.path, count: 0, files: [] });
        const files = opts.wholeVault ? this.app.vault.getMarkdownFiles() : this.getScopeFiles();
        for (const file of files) {
          const here = /* @__PURE__ */ new Map();
          try {
            const text = await this.app.vault.cachedRead(file);
            for (const m of this.findMatches(text, this.canonicalForPath(file.path), { protect: true })) {
              here.set(m.canonical, (here.get(m.canonical) || 0) + 1);
            }
          } catch (e) {
          }
          if (opts.includeLinks) {
            const cache = this.app.metadataCache.getFileCache(file);
            for (const link of cache && cache.links || []) {
              const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
              if (dest && this.isGlossaryFile(dest))
                here.set(dest.basename, (here.get(dest.basename) || 0) + 1);
            }
          }
          for (const [canonical, n] of here) {
            const entry = counts.get(canonical);
            if (!entry)
              continue;
            entry.count += n;
            entry.files.push({ path: file.path, count: n });
          }
        }
        return [...counts.values()];
      },
      // Frequent in-scope words that are not yet terms — candidates worth defining.
      // Pure frequency: a word is kept when its lemma appears in at least
      // candidateMinNotes notes. Inflected forms collapse onto one lemma.
      async collectCandidates(opts = {}) {
        const minLen = Math.max(1, this.settings.minTermLength || 1);
        const minNotes = Math.max(1, this.settings.candidateMinNotes || 1);
        const groups = /* @__PURE__ */ new Map();
        const files = opts.wholeVault ? this.app.vault.getMarkdownFiles() : this.getScopeFiles();
        const notice = new Notice2(t2("notice.scanning"), 0);
        try {
          for (let i = 0; i < files.length; i++) {
            if (i % 25 === 0)
              notice.setMessage(t2("notice.scanningProgress", { current: i + 1, total: files.length }));
            let text;
            try {
              text = await this.app.vault.cachedRead(files[i]);
            } catch (e) {
              continue;
            }
            const protect = this.computeProtected(text);
            for (const m of text.matchAll(/[\p{L}\p{Nd}]+/gu)) {
              const raw = m[0];
              if (/^\p{Nd}+$/u.test(raw))
                continue;
              if (this.overlapsProtected(protect, m.index, m.index + raw.length))
                continue;
              if (this.keysFor(raw).some((k) => this.index.byKey.has(k) || this.excludeWordKeys.has(k)))
                continue;
              const lemma = this.lemmaFor(raw);
              if (lemma.length < minLen)
                continue;
              let g = groups.get(lemma);
              if (!g) {
                g = { forms: /* @__PURE__ */ new Map(), total: 0, files: /* @__PURE__ */ new Set() };
                groups.set(lemma, g);
              }
              g.forms.set(raw, (g.forms.get(raw) || 0) + 1);
              g.total++;
              g.files.add(files[i].path);
            }
          }
        } finally {
          notice.hide();
        }
        const out = [];
        for (const [lemma, g] of groups) {
          if (g.files.size < minNotes)
            continue;
          let display = lemma, best = -1;
          for (const [form, n] of g.forms)
            if (n > best) {
              best = n;
              display = form;
            }
          out.push({ lemma, display, count: g.total, docFreq: g.files.size });
        }
        out.sort((a, b) => b.docFreq - a.docFreq || b.count - a.count);
        return out.slice(0, 100);
      }
    };
  }
});

// src/shared/index-events.js
var require_index_events = __commonJS({
  "src/shared/index-events.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      // Returns an unsubscribe function.
      onIndexChange(cb) {
        if (typeof cb !== "function")
          return () => {
          };
        if (!this._indexListeners)
          this._indexListeners = /* @__PURE__ */ new Set();
        this._indexListeners.add(cb);
        return () => this._indexListeners.delete(cb);
      },
      notifyIndexChange() {
        for (const cb of this._indexListeners || []) {
          try {
            cb();
          } catch (e) {
            console.error(`${this.manifest.id}: index listener failed`, e);
          }
        }
      }
    };
  }
});

// src/overview-view.js
var require_overview_view = __commonJS({
  "src/overview-view.js"(exports2, module2) {
    "use strict";
    var { ItemView } = require("obsidian");
    var { t: t2, plural: plural2 } = require_i18n();
    var OVERVIEW_VIEW_TYPE2 = "glossary-overview";
    var GlossaryOverviewView2 = class extends ItemView {
      constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
        this.terms = [];
        this.candidates = [];
      }
      getViewType() {
        return OVERVIEW_VIEW_TYPE2;
      }
      getDisplayText() {
        return t2("view.title");
      }
      getIcon() {
        return "book-a";
      }
      async onOpen() {
        this.contentEl.addClass("glossary-overview");
        this.renderShell();
        this.unsubscribe = this.plugin.onIndexChange(() => this.refreshTerms());
        await this.refresh();
      }
      async onClose() {
        if (this.unsubscribe)
          this.unsubscribe();
      }
      renderShell() {
        const root = this.contentEl;
        root.empty();
        const bar = root.createDiv({ cls: "glossary-overview-bar" });
        bar.createEl("button", { text: t2("overview.rescan"), cls: "mod-cta" }).onclick = () => this.refresh();
        const scope = bar.createEl("label", { cls: "glossary-overview-check" });
        const sc = scope.createEl("input", { type: "checkbox" });
        sc.checked = this.plugin.settings.overviewWholeVault;
        scope.createSpan({ text: t2("overview.wholeVault") });
        scope.setAttribute("aria-label", t2("overview.wholeVaultAria"));
        sc.onchange = async () => {
          this.plugin.settings.overviewWholeVault = sc.checked;
          await this.plugin.saveSettings();
          await this.refresh();
        };
        this.termsSection = root.createDiv();
        this.candidatesSection = root.createDiv();
      }
      foldHeader(el, label, count, collapsed, onToggle) {
        const head = el.createDiv({ cls: "glossary-overview-head is-toggle" });
        head.createSpan({ cls: "glossary-overview-caret", text: collapsed ? "\u25B8" : "\u25BE" });
        head.createSpan({ text: collapsed ? label : `${label} (${count})` });
        head.onclick = onToggle;
      }
      sortControl(controls, options, value, onChange) {
        controls.createSpan({ text: t2("overview.sort") });
        const sel = controls.createEl("select");
        for (const [text, val] of options)
          sel.createEl("option", { text, value: val });
        sel.value = value;
        sel.onchange = () => onChange(sel.value);
      }
      async refresh() {
        await this.loadUsage();
        this.renderTerms();
        await this.refreshCandidates();
      }
      async loadUsage() {
        this.terms = await this.plugin.getUsageReport({
          includeLinks: this.plugin.settings.overviewCountLinks,
          wholeVault: this.plugin.settings.overviewWholeVault
        });
      }
      // Index changes (new/renamed/excluded terms) only change membership, not counts —
      // carry counts over and let an explicit Rescan recompute them.
      refreshTerms() {
        const prev = new Map(this.terms.map((t3) => [t3.canonical, t3.count]));
        this.terms = this.plugin.getTerms().map((t3) => ({ canonical: t3.canonical, path: t3.path, count: prev.get(t3.canonical) || 0 }));
        this.renderTerms();
      }
      async refreshCandidates() {
        if (!this.plugin.settings.overviewCandidatesCollapsed) {
          this.candidates = await this.plugin.collectCandidates({ wholeVault: this.plugin.settings.overviewWholeVault });
        }
        this.renderCandidates();
      }
      renderTerms() {
        const el = this.termsSection;
        el.empty();
        const collapsed = this.plugin.settings.overviewTermsCollapsed;
        this.foldHeader(el, t2("overview.terms"), this.terms.length, collapsed, () => this.toggleTerms());
        if (collapsed)
          return;
        const controls = el.createDiv({ cls: "glossary-overview-controls" });
        this.sortControl(controls, [[t2("overview.sortMostUsed"), "usage"], [t2("overview.sortName"), "name"]], this.plugin.settings.overviewSort, async (v) => {
          this.plugin.settings.overviewSort = v;
          await this.plugin.saveSettings();
          this.renderTerms();
        });
        const check = controls.createEl("label", { cls: "glossary-overview-check" });
        const cb = check.createEl("input", { type: "checkbox" });
        cb.checked = this.plugin.settings.overviewCountLinks;
        check.createSpan({ text: t2("overview.countLinks") });
        check.setAttribute("aria-label", t2("overview.countLinksAria"));
        cb.onchange = async () => {
          this.plugin.settings.overviewCountLinks = cb.checked;
          await this.plugin.saveSettings();
          await this.loadUsage();
          this.renderTerms();
        };
        const list = el.createDiv({ cls: "glossary-overview-list" });
        if (!this.terms.length) {
          list.createDiv({ cls: "glossary-overview-empty", text: t2("overview.noTerms") });
          return;
        }
        const byName = this.plugin.settings.overviewSort === "name";
        const sorted = this.terms.slice().sort((a, b) => byName ? a.canonical.localeCompare(b.canonical) : b.count - a.count || a.canonical.localeCompare(b.canonical));
        for (const term of sorted) {
          const row = list.createDiv({ cls: "glossary-overview-row" });
          if (term.count === 0)
            row.addClass("is-orphan");
          const name = row.createSpan({ cls: "glossary-overview-name is-link", text: term.canonical });
          name.setAttribute("aria-label", t2("overview.openAria"));
          name.addEventListener("click", () => this.plugin.openTerm(term.canonical, "", false));
          name.addEventListener("mousedown", (e) => {
            if (e.button === 1)
              e.preventDefault();
          });
          name.addEventListener("auxclick", (e) => {
            if (e.button === 1) {
              e.preventDefault();
              this.plugin.openTerm(term.canonical, "", true);
            }
          });
          row.createSpan({ cls: "glossary-overview-count", text: term.count === 0 ? t2("overview.unused") : plural2("use", term.count) });
          const actions2 = row.createSpan({ cls: "glossary-overview-actions" });
          const link = actions2.createEl("a", { cls: "glossary-overview-act", text: t2("overview.linkAll") });
          link.onclick = () => this.plugin.materializeTermScope(term.canonical);
        }
      }
      renderCandidates() {
        const el = this.candidatesSection;
        el.empty();
        const collapsed = this.plugin.settings.overviewCandidatesCollapsed;
        this.foldHeader(el, t2("overview.candidates"), this.candidates.length, collapsed, () => this.toggleCandidates());
        if (collapsed)
          return;
        const controls = el.createDiv({ cls: "glossary-overview-controls" });
        this.sortControl(controls, [[t2("overview.sortNotes"), "notes"], [t2("overview.sortMentions"), "count"]], this.plugin.settings.overviewCandidateSort, async (v) => {
          this.plugin.settings.overviewCandidateSort = v;
          await this.plugin.saveSettings();
          this.renderCandidates();
        });
        controls.createSpan({ text: t2("overview.minNotes") });
        const input = controls.createEl("input", { type: "number" });
        input.min = "1";
        input.value = String(this.plugin.settings.candidateMinNotes);
        input.onchange = async () => {
          const n = Math.max(1, parseInt(input.value, 10) || 1);
          input.value = String(n);
          this.plugin.settings.candidateMinNotes = n;
          await this.plugin.saveSettings();
          await this.refreshCandidates();
        };
        const list = el.createDiv({ cls: "glossary-overview-list" });
        if (!this.candidates.length) {
          list.createDiv({ cls: "glossary-overview-empty", text: t2("overview.noCandidates") });
          return;
        }
        const byCount = this.plugin.settings.overviewCandidateSort === "count";
        const sorted = this.candidates.slice().sort((a, b) => byCount ? b.count - a.count || b.docFreq - a.docFreq : b.docFreq - a.docFreq || b.count - a.count);
        for (const c of sorted) {
          const row = list.createDiv({ cls: "glossary-overview-row" });
          row.createSpan({ cls: "glossary-overview-name", text: c.display });
          row.createSpan({ cls: "glossary-overview-count", text: `${plural2("note", c.docFreq)} \xB7 ${plural2("use", c.count)}` });
          const actions2 = row.createSpan({ cls: "glossary-overview-actions" });
          const add = actions2.createEl("a", { cls: "glossary-overview-act", text: t2("overview.addTerm") });
          add.onclick = async () => {
            await this.plugin.createTermNote(null, c.display, false);
            this.drop(c);
          };
          const dismiss = actions2.createEl("a", { cls: "glossary-overview-act", text: "\u2715" });
          dismiss.onclick = async () => {
            await this.plugin.addToExclusion("excludeWords", c.display.toLowerCase());
            this.drop(c);
          };
        }
      }
      drop(candidate) {
        this.candidates = this.candidates.filter((x) => x !== candidate);
        this.renderCandidates();
      }
      toggleTerms() {
        this.plugin.settings.overviewTermsCollapsed = !this.plugin.settings.overviewTermsCollapsed;
        this.plugin.saveSettings();
        this.renderTerms();
      }
      toggleCandidates() {
        const collapsed = !this.plugin.settings.overviewCandidatesCollapsed;
        this.plugin.settings.overviewCandidatesCollapsed = collapsed;
        this.plugin.saveSettings();
        if (collapsed)
          this.renderCandidates();
        else
          this.refreshCandidates();
      }
    };
    module2.exports = { GlossaryOverviewView: GlossaryOverviewView2, OVERVIEW_VIEW_TYPE: OVERVIEW_VIEW_TYPE2 };
  }
});

// src/shared/menu.js
var require_menu = __commonJS({
  "src/shared/menu.js"(exports2, module2) {
    "use strict";
    var obsidian = require("obsidian");
    var submenuSupport = null;
    function supportsSubmenu() {
      if (submenuSupport !== null)
        return submenuSupport;
      submenuSupport = false;
      try {
        const probe = new obsidian.Menu();
        probe.addItem((item) => {
          submenuSupport = typeof item.setSubmenu === "function";
        });
      } catch (e) {
        submenuSupport = false;
      }
      return submenuSupport;
    }
    function menuSection2(menu, label, grouped, icon) {
      if (!grouped)
        return menu;
      if (!supportsSubmenu()) {
        return {
          addItem(cb) {
            return menu.addItem((item) => {
              const setTitle = item.setTitle.bind(item);
              item.setTitle = (title) => setTitle(`${label}: ${title}`);
              cb(item);
            });
          },
          addSeparator() {
            return menu.addSeparator();
          }
        };
      }
      let sub = null;
      const ensure = () => {
        if (!sub) {
          menu.addItem((item) => {
            item.setTitle(label);
            if (icon)
              item.setIcon(icon);
            sub = item.setSubmenu();
          });
        }
        return sub;
      };
      return {
        addItem(cb) {
          return ensure().addItem(cb);
        },
        addSeparator() {
          return sub ? sub.addSeparator() : null;
        }
      };
    }
    var STORE = "__linkerMenuSections";
    function sharedSection(menu, key, label, icon) {
      if (!supportsSubmenu())
        return menuSection2(menu, label, true);
      let store = menu[STORE];
      if (!store) {
        store = {};
        try {
          Object.defineProperty(menu, STORE, { value: store, enumerable: false, configurable: true });
        } catch (e) {
          return menuSection2(menu, label, true, icon);
        }
      }
      if (!store[key]) {
        menu.addItem((item) => {
          item.setTitle(label);
          if (icon)
            item.setIcon(icon);
          store[key] = item.setSubmenu();
        });
      }
      return store[key];
    }
    module2.exports = { menuSection: menuSection2, sharedSection, supportsSubmenu };
  }
});

// src/shared/popover.js
var require_popover = __commonJS({
  "src/shared/popover.js"(exports2, module2) {
    "use strict";
    var SHOW_DELAY = 200;
    var HIDE_GRACE = 250;
    var EDGE_PAD = 12;
    var Popover = class {
      constructor(opts) {
        this.cls = opts.cls;
        this.hiddenCls = opts.hiddenCls;
        this.showDelay = opts.showDelay == null ? SHOW_DELAY : opts.showDelay;
        this.hideGrace = opts.hideGrace == null ? HIDE_GRACE : opts.hideGrace;
        this.onHide = opts.onHide || null;
        this.onDestroy = opts.onDestroy || null;
        this.keepAlive = opts.keepAlive || null;
        this.el = null;
        this.timer = null;
        this.hideTimer = null;
        this.key = "";
        this.pendingKey = "";
        this.token = 0;
      }
      ensureEl() {
        if (!this.el) {
          this.el = document.body.createDiv({ cls: `${this.cls} ${this.hiddenCls}` });
          this.el.addEventListener("mouseenter", () => this.cancelHide());
          this.el.addEventListener("mouseleave", () => this.leave());
        }
        return this.el;
      }
      isVisible() {
        return !!this.el && !this.el.classList.contains(this.hiddenCls);
      }
      contains(node) {
        return !!this.el && !!node && this.el.contains(node);
      }
      cancelHide() {
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
      }
      // Re-asking for what is already up, or already on its way, changes nothing — otherwise
      // every mouse move would restart the timer.
      schedule(key, x, y, build) {
        this.cancelHide();
        if (key === this.key && this.isVisible())
          return;
        if (key === this.pendingKey)
          return;
        this.pendingKey = key;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
          this.pendingKey = "";
          this.show(key, x, y, build);
        }, this.showDelay);
      }
      leave() {
        if (this.hideTimer)
          return;
        this.hideTimer = setTimeout(() => {
          this.hideTimer = null;
          if (this.keepAlive && this.keepAlive()) {
            this.leave();
            return;
          }
          this.hide();
        }, this.hideGrace);
      }
      async show(key, x, y, build) {
        const token = ++this.token;
        const ctx = { isCurrent: () => token === this.token };
        const el = this.ensureEl();
        el.empty();
        const after = await build(el, ctx);
        if (after === false || !ctx.isCurrent())
          return;
        this.key = key;
        el.style.visibility = "hidden";
        el.style.left = "-9999px";
        el.style.top = "0px";
        el.removeClass(this.hiddenCls);
        if (typeof after === "function")
          after();
        const r = el.getBoundingClientRect();
        let left = x + EDGE_PAD;
        let top = y + EDGE_PAD;
        if (left + r.width > window.innerWidth - EDGE_PAD)
          left = Math.max(EDGE_PAD, x - EDGE_PAD - r.width);
        if (top + r.height > window.innerHeight - EDGE_PAD)
          top = Math.max(EDGE_PAD, y - EDGE_PAD - r.height);
        el.style.left = left + "px";
        el.style.top = top + "px";
        el.style.visibility = "visible";
      }
      hide() {
        clearTimeout(this.timer);
        clearTimeout(this.hideTimer);
        this.hideTimer = null;
        this.pendingKey = "";
        this.key = "";
        this.token++;
        if (this.onHide)
          this.onHide();
        if (this.el) {
          this.el.addClass(this.hiddenCls);
          this.el.empty();
        }
      }
      destroy() {
        clearTimeout(this.timer);
        clearTimeout(this.hideTimer);
        this.token++;
        if (this.onDestroy)
          this.onDestroy();
        if (this.el) {
          this.el.remove();
          this.el = null;
        }
      }
    };
    module2.exports = { Popover, SHOW_DELAY, HIDE_GRACE };
  }
});

// src/shared/prose/choices.js
var require_choices = __commonJS({
  "src/shared/prose/choices.js"(exports2, module2) {
    "use strict";
    var { Popover } = require_popover();
    var { Component } = require("obsidian");
    var labelOf = (c) => typeof c === "object" && c ? c.label : c;
    var ChoicePopover2 = class {
      // `hover(target, event, el, hoverParent)` previews one of our own targets; `open(target)`
      // follows it.
      constructor(opts) {
        this.opts = opts;
        this.component = null;
        this.pop = new Popover({
          cls: `${opts.cls}-choices`,
          hiddenCls: `${opts.cls}-hidden`,
          onHide: () => this.unloadComponent(),
          onDestroy: () => this.unloadComponent(),
          // The preview a row opens is Obsidian's own element in the body, not a child of ours,
          // so moving the pointer into it reads as leaving the list.
          keepAlive: () => !!document.querySelector(".hover-popover:hover")
        });
      }
      isVisible() {
        return this.pop.isVisible();
      }
      contains(node) {
        return this.pop.contains(node);
      }
      cancelHide() {
        this.pop.cancelHide();
      }
      leave() {
        this.pop.leave();
      }
      hide() {
        this.pop.hide();
      }
      destroy() {
        this.pop.destroy();
      }
      // Unloading the component closes any preview still hanging off it.
      unloadComponent() {
        if (this.component) {
          this.component.unload();
          this.component = null;
        }
      }
      schedule(candidates, x, y) {
        if (!candidates || candidates.length < 2)
          return;
        const key = candidates.map(labelOf).join("\0");
        this.pop.schedule(key, x, y, (el) => this.build(candidates, el));
      }
      // A fresh component per preview, so opening one closes the last instead of stacking one
      // preview per row the pointer crossed.
      newComponent() {
        this.unloadComponent();
        this.component = new Component();
        this.component.load();
        return this.component;
      }
      build(candidates, el) {
        this.unloadComponent();
        const cls = this.opts.cls;
        el.createDiv({ cls: `${cls}-choices-title`, text: this.opts.title });
        const list = el.createDiv({ cls: `${cls}-choices-list` });
        for (const c of candidates) {
          const foreign = typeof c === "object" && c !== null;
          const row = list.createDiv({ cls: `${cls}-choices-item`, text: labelOf(c) });
          row.addEventListener("mouseenter", (event) => {
            const parent = this.newComponent();
            if (foreign) {
              if (typeof c.hover === "function")
                c.hover(event, row, parent);
            } else {
              this.opts.hover(c, event, row, parent);
            }
          });
          row.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.hide();
            if (foreign)
              c.open();
            else
              this.opts.open(c);
          });
        }
      }
    };
    module2.exports = { ChoicePopover: ChoicePopover2 };
  }
});

// src/locales/en.js
var require_en2 = __commonJS({
  "src/locales/en.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      // Commands
      "cmd.openOverview": "Open glossary overview",
      "cmd.linkThisNote": "Link glossary terms: this note",
      "cmd.linkSelection": "Link glossary terms: selection",
      "cmd.linkAllNotes": "Link glossary terms: all notes",
      "cmd.unlinkThisNote": "Unlink glossary terms: this note",
      "cmd.unlinkSelection": "Unlink glossary terms: selection",
      "cmd.unlinkAllNotes": "Unlink glossary terms: all notes",
      "cmd.collectThisNote": "Collect aliases from links: this note",
      "cmd.collectAllNotes": "Collect aliases from links: all notes",
      "cmd.createTerm": "Create glossary term from selection",
      "cmd.rebuildIndex": "Rebuild glossary index",
      "cmd.addAlias": "Add alias to glossary term",
      "ribbon.tooltip": "Glossary overview",
      "statusBar.aria": "{n} glossary term(s) on this page \u2014 click to link them",
      // Native context-menu items (brand prefix "Glossary:" kept verbatim)
      "menu.createTermLink": "Glossary: create term & link",
      "menu.createTerm": "Glossary: create term",
      "menu.addAlias": "Glossary: make this an alias for\u2026",
      // No plugin name on these: they act on the link under the cursor, and a link belongs to
      // exactly one linker, so there is never a second one of them to tell apart. The name goes
      // on configuration items instead, where the reader is picking which plugin to change.
      "menu.unlinkThisTerm": "Unlink this term",
      "menu.collectThisAlias": "Collect this alias",
      // Says whose aliases: the heading linker offers its own version on the same note menu,
      // and the two write to different places.
      "menu.collectFromNote": "Collect glossary aliases from links",
      "menu.removeFromAlwaysExcluded": "Glossary: remove from always-excluded",
      "menu.addToAlwaysExcluded": "Glossary: add {noun} to always-excluded",
      "menu.removeFromScope": "Glossary: remove {noun} from scope",
      "menu.includeInScope": "Glossary: include {noun} in scope",
      // Linking a word from Obsidian's own editor menu. The three ways to link differ only in
      // how far they reach, so they share one entry with the choice inside it. Each reads on its
      // own — a submenu item is read without its parent in view, so "Here" alone would not say
      // what it does.
      "menu.linkScopeThisNote": 'Link {scope} "{display}" to term: this note',
      "menu.linkScopeAllNotes": 'Link {scope} "{display}" to term: all notes',
      "menu.openTitle": "Open\u2026",
      "menu.openNewTabTitle": "Open in new tab\u2026",
      // Exclusion menu items
      "exclude.words": "excluded words",
      "exclude.terms": "excluded terms",
      "exclude.addPrefixed": 'Glossary: add "{value}" to {noun}',
      "exclude.removePrefixed": 'Glossary: remove "{value}" from {noun}',
      "exclude.add": 'Add "{value}" to {noun}',
      "exclude.remove": 'Remove "{value}" from {noun}',
      // Notices
      "notice.indexRebuilt": "Glossary Linker: index rebuilt",
      "notice.unlinked": "Glossary Linker: unlinked",
      "notice.noActiveNote": "No active note",
      "notice.noSelection": "No selection",
      "notice.noMatches": "Glossary Linker: no matches found",
      "notice.noGlossaryLinks": "Glossary Linker: no glossary links found",
      "notice.noteChanged": "Glossary Linker: note changed since preview, nothing written",
      "notice.scopeWritten": "Glossary Linker: {files}, {links}",
      "notice.scopeSkipped": ", {n} skipped (changed since preview)",
      "notice.linksCreated": "Glossary Linker: {links} created",
      "notice.linksRemoved": "Glossary Linker: {links} removed",
      "notice.linkCreatedSingle": "Glossary Linker: link created",
      "notice.occurrenceNotFound": "Glossary Linker: occurrence not found",
      "notice.noOccurrences": "Glossary Linker: no occurrences found",
      "notice.scanning": "Glossary Linker: scanning\u2026",
      "notice.scanningProgress": "Glossary Linker: scanning {current}/{total}\u2026",
      "notice.nothingSelected": "Glossary Linker: nothing selected",
      "notice.alreadyMatchesOpened": 'Glossary Linker: "{sel}" already matches "{term}" \u2014 opened it',
      "notice.invalidTermName": "Glossary Linker: selection is not a valid term name",
      "notice.termExists": 'Glossary Linker: term "{name}" already exists',
      "notice.couldNotCreate": "Glossary Linker: could not create term note",
      "notice.templateNotFound": "Glossary Linker: template not found: {path}",
      "notice.couldNotReadTemplate": "Glossary Linker: could not read template",
      "notice.alreadyExcluded": 'Glossary Linker: "{value}" is already excluded',
      "notice.addedToExcluded": 'Glossary Linker: added "{value}" to {where}',
      "notice.wasNotExcluded": 'Glossary Linker: "{value}" was not excluded',
      "notice.removedFromExcluded": 'Glossary Linker: removed "{value}" from {where}',
      "notice.aliasesAdded": "Glossary Linker: {aliases} added",
      "notice.noNewAliases": "Glossary Linker: no new aliases found",
      "notice.wordingMatchesTerm": "Glossary Linker: that wording already matches the term",
      "notice.noNewAlias": "Glossary Linker: no new alias to collect",
      "notice.pathAddedExcluded": 'Glossary Linker: added "{entry}" to always-excluded paths',
      "notice.pathRemovedExcluded": 'Glossary Linker: removed "{entry}" from always-excluded paths',
      "notice.pathAddedScope": 'Glossary Linker: added "{entry}" to paths in scope',
      "notice.pathRemovedScope": 'Glossary Linker: removed "{entry}" from paths in scope',
      // Settings — headings
      "set.heading.collecting": "Collecting aliases",
      "set.heading.overview": "Overview",
      // Settings — entries
      "set.glossaryFolder.name": "Glossary folder",
      "set.glossaryFolder.desc": "Folder with one note per term (file name = the term title). Leave empty to use the whole vault as the glossary.",
      "set.termTemplate.name": "Term template",
      "set.termTemplate.desc": "Note used as the body of new term notes; placeholders like {{title}} and {{date}} are filled in. Empty = blank note.",
      "set.scopeMode.name": "Link scope",
      "set.scopeMode.desc": "Which notes terms are highlighted and linked in.",
      "set.scopeMode.folders": "Listed paths only",
      "set.scopeMode.vault": "Everywhere",
      "set.scopeFolders.name": "Paths to include",
      "set.scopeFolders.desc": "A file or a folder. Only these (and notes inside listed folders) are in scope.",
      "set.excludeFolders.name": "Always-excluded paths",
      "set.excludeFolders.desc": "A file or a folder, never highlighted, linked or scanned, whatever the mode above is.",
      "set.folderList.add": "Add path\u2026",
      "set.folderList.remove": "Remove",
      "set.folderList.addAria": "Add",
      "set.matchMode.name": "Morphology",
      "set.matchMode.desc": "How an inflected word is matched to a term.",
      "set.matchMode.stemmer": "Stemmer (recommended)",
      "set.matchMode.endingStrip": "Ending strip",
      "set.matchMode.exact": "Exact match",
      "set.minTermLength.name": "Minimum term length",
      "set.minTermLength.desc": "Ignore term titles and aliases shorter than this many characters, so single letters do not match everywhere.",
      "set.languages.desc": "Bundled morphology modules \u2014 {enabled} of {total} enabled",
      "set.languages.invalidSuffix": ", {n} invalid",
      "set.lang.invalid": "Invalid module: {error}",
      "set.linkFirstOnly.desc": "When turning terms into links, link only the first occurrence of each term on a page.",
      "set.excludeTerms.name": "Excluded terms",
      "set.excludeTerms.desc": "Term titles or aliases, one per line \u2014 drops the whole matching entry from the index.",
      "set.excludeWords.name": "Excluded words",
      "set.excludeWords.desc": "Surface words, one per line, that never trigger a link even if they match a term.",
      "set.highlightInReading.desc": "Underline detected terms as clickable links in Reading view (file unchanged).",
      "set.editingHighlight.name": "Highlight while editing",
      "set.editingHighlight.desc": "Underline terms in the editor (Live Preview / Source) too.",
      "set.editingHighlight.off": "Off",
      "set.editingHighlight.live": "Live (as you type)",
      "set.skipHeadings.desc": "Do not highlight or link terms that appear inside Markdown headings.",
      "set.statusBar.desc": "Show how many glossary terms are on the current note in the status bar.",
      "set.statusBarIncludeLinks.name": "Count direct links",
      "set.statusBarIncludeLinks.desc": "Also count terms already linked directly, not only plain-text mentions.",
      "set.linkSuggest.desc": "As you type in an in-scope note, offer to insert a [[link]] to a matching glossary term (prefix of a title/alias, or an inflected form).",
      "set.suggestMinChars.name": "Minimum characters",
      "set.suggestSkipAfter.desc": "Don't suggest when the word follows one of these characters, so other autocompletes (tags, code links, math) keep their slot. Leave empty to disable.",
      "set.aliasHarvestMode.name": "Alias form",
      "set.aliasHarvestMode.desc": "How collected link text is stored as an alias.",
      "set.aliasHarvestMode.lemma": "Base form",
      "set.aliasHarvestMode.literal": "As written",
      "set.aliasHarvestMode.both": "Both",
      "set.harvestOnSave.name": "Collect on save",
      "set.harvestOnSave.desc": "Collect aliases automatically when a note is saved.",
      "set.harvestOnSave.off": "Off",
      "set.harvestOnSave.silent": "Silent (add automatically)",
      "set.harvestOnSave.preview": "Ask first",
      "set.harvestSingleWordOnly.name": "Single-word aliases only",
      "set.harvestSingleWordOnly.desc": "Only collect link texts that are a single word.",
      "set.harvestMinLength.name": "Minimum alias length",
      "set.harvestMinLength.desc": "Ignore collected aliases shorter than this many characters.",
      "set.aliasCollisionWarnings.name": "Warn about alias collisions",
      "set.aliasCollisionWarnings.desc": "When collecting an alias or creating a term, flag wording that already matches a different term (so you can avoid making a word point at two terms).",
      "set.menuTurnInto.name": '"Link to term" items',
      "set.menuTurnInto.desc": 'Show the "Link to term" / "Link all \u2026 to term" actions when right-clicking a highlighted term.',
      "set.menuCollect.name": '"Collect aliases" item',
      "set.menuCollect.desc": "Offer to collect a link\u2019s own wording as an alias \u2014 on the link itself, and for a whole note from its right-click menu.",
      "set.menuExclude.name": '"Exclude word / term" items',
      "set.menuExclude.desc": 'Show "Add \u2026 to excluded words / terms" when right-clicking a term, and "Add \u2026 to excluded words" on a selected word.',
      "set.menuOpen.name": '"Open glossary note" items',
      "set.menuOpen.desc": 'Show "Open glossary note" / "Open in new tab" when right-clicking a highlighted term.',
      "set.menuCreateTerm.name": '"Create term from selection" items',
      "set.menuCreateTerm.desc": 'Show the "Glossary: create term\u2026" actions when right-clicking a plain text selection.',
      "set.menuAddAlias.name": '"Make this an alias" item',
      "set.menuAddAlias.desc": "Show a context-menu item on a plain text selection that attaches it as an alias to a term you pick.",
      "set.menuUnlink.name": '"Unlink term" item',
      "set.menuUnlink.desc": 'Show "Glossary: unlink this term" when right-clicking an existing glossary link.',
      "set.showRibbonIcon.name": "Ribbon icon",
      "set.showRibbonIcon.desc": 'Show a ribbon button that opens the glossary overview panel. The "Open glossary overview" command works either way.',
      "set.rebuild.name": "Rebuild glossary index",
      "set.rebuild.desc": "Re-scan the glossary folder now.",
      "set.collecting.desc": "Reads the links you already made by hand, like [[Term|some wording]], and adds that wording to the term's aliases \u2014 so the same wording links automatically next time.",
      "set.folderNotFound": "\u26A0 Folder not found \u2014 no terms will be indexed.",
      "set.termsIndexed": "{terms} indexed.",
      "set.wholeVaultStatus": "Whole vault is the glossary \u2014 {terms} indexed.",
      // Modals
      "modal.materialize.title": "Link glossary terms \u2014 preview",
      "modal.materialize.summary": "Files: {files}, replacements: {replacements}",
      "modal.materialize.ambiguous": "{n} ambiguous word(s) match more than one term \u2014 pick one (applies to every occurrence):",
      "modal.skipOption": "(skip \u2014 leave as text)",
      "modal.leftAsText": "\u2014 left as text \u2014",
      "modal.harvest.title": "Collect aliases \u2014 preview",
      "modal.harvest.summary": "Terms: {terms}, new aliases: {aliases}",
      "modal.harvest.alsoMatches": "Also matches: {terms}",
      "modal.harvest.alreadyPresent": "Already present (skipped): {items}",
      "modal.unlink.title": "Unlink glossary terms \u2014 preview",
      "modal.unlink.summary": "Files: {files}, links to remove: {links}",
      "modal.choose.body": "This word has more than one match \u2014 pick one:",
      "modal.alias.pickTerm": "Which term is this an alias for?",
      "modal.alias.title": 'Alias for "{term}"',
      "modal.alias.body": "A form the stemmer cannot derive from the title: an abbreviation (CNS, PNS), a synonym, or an alternate spelling. Matched verbatim, so type it exactly as it appears.",
      "notice.noTerms": "No glossary terms in the vault yet.",
      "notice.aliasExists": '"{alias}" is already linked to "{term}".',
      "notice.aliasAdded": 'Added alias "{alias}" \u2192 "{term}".',
      "notice.aliasAddedCollision": 'Added "{alias}" \u2192 "{term}", but it already matches: {others}.',
      "notice.termFileMissing": 'Term note for "{term}" not found \u2014 it may have been moved or deleted.',
      "btn.write": "Write",
      "label.selection": "selection",
      // Overview panel
      "view.title": "Glossary",
      "overview.rescan": "Rescan",
      "overview.wholeVault": "whole vault",
      "overview.wholeVaultAria": "Scan every note instead of only the linker scope",
      "overview.terms": "Terms",
      "overview.candidates": "Candidates",
      "overview.sort": "Sort",
      "overview.sortMostUsed": "Most used",
      "overview.sortName": "Name",
      "overview.countLinks": "count links",
      "overview.countLinksAria": "Also count existing [[Term]] links, not just plain-text mentions",
      "overview.noTerms": "No terms indexed.",
      "overview.openAria": "Open \u2014 middle-click for a new tab",
      "overview.unused": "unused \u26A0",
      "overview.linkAll": "link all",
      "overview.sortNotes": "Notes",
      "overview.sortMentions": "Mentions",
      "overview.minNotes": "Min notes",
      "overview.noCandidates": "No candidates.",
      "overview.addTerm": "+ term",
      // Autocomplete suggestions
      // The line under a name in the autocomplete popup. Kept to a fragment, not a sentence:
      // it sits under the term it describes, and the heading linker's candidates share the same
      // popup, so the two have to read as one list.
      "suggest.inflection": "word form",
      "suggest.alias": "as \u201C{form}\u201D",
      // Highlight tooltip
      // Plural noun phrases
      "plural.term": { one: "{n} term", other: "{n} terms" },
      "plural.use": { one: "{n} use", other: "{n} uses" },
      "plural.note": { one: "{n} note", other: "{n} notes" },
      "plural.link": { one: "{n} link(s)", other: "{n} link(s)" },
      "plural.file": { one: "{n} file(s)", other: "{n} file(s)" },
      "plural.alias": { one: "{n} alias(es)", other: "{n} alias(es)" }
    };
  }
});

// src/locales/ru.js
var require_ru2 = __commonJS({
  "src/locales/ru.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      "cmd.openOverview": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u0431\u0437\u043E\u0440 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F",
      "cmd.linkThisNote": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F: \u044D\u0442\u0430 \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
      "cmd.linkSelection": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F: \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435",
      "cmd.linkAllNotes": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F: \u0432\u0441\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
      "cmd.unlinkThisNote": "\u0423\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u044B: \u044D\u0442\u0430 \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
      "cmd.unlinkSelection": "\u0423\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u044B: \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435",
      "cmd.unlinkAllNotes": "\u0423\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u044B: \u0432\u0441\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
      "cmd.collectThisNote": "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u0438\u0437 \u0441\u0441\u044B\u043B\u043E\u043A: \u044D\u0442\u0430 \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
      "cmd.collectAllNotes": "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u0438\u0437 \u0441\u0441\u044B\u043B\u043E\u043A: \u0432\u0441\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
      "cmd.createTerm": "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F \u0438\u0437 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u044F",
      "cmd.rebuildIndex": "\u041F\u0435\u0440\u0435\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0438\u043D\u0434\u0435\u043A\u0441 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F",
      "cmd.addAlias": "\u041F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C \u043A \u0442\u0435\u0440\u043C\u0438\u043D\u0443",
      "ribbon.tooltip": "\u041E\u0431\u0437\u043E\u0440 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F",
      "statusBar.aria": "\u0422\u0435\u0440\u043C\u0438\u043D\u043E\u0432 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F \u043D\u0430 \u044D\u0442\u043E\u0439 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435: {n} \u2014 \u043D\u0430\u0436\u043C\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u0441\u0432\u044F\u0437\u0430\u0442\u044C",
      "menu.createTermLink": "Glossary: \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D \u0438 \u0441\u0432\u044F\u0437\u0430\u0442\u044C",
      "menu.createTerm": "Glossary: \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D",
      "menu.addAlias": "Glossary: \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u043C \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u2026",
      "menu.unlinkThisTerm": "\u0423\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u044D\u0442\u043E\u0442 \u0442\u0435\u0440\u043C\u0438\u043D",
      "menu.collectThisAlias": "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u044D\u0442\u043E\u0442 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C",
      "menu.collectFromNote": "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F \u0438\u0437 \u0441\u0441\u044B\u043B\u043E\u043A",
      "menu.removeFromAlwaysExcluded": "Glossary: \u0443\u0431\u0440\u0430\u0442\u044C \u0438\u0437 \u0432\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445",
      "menu.addToAlwaysExcluded": "Glossary: \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C {noun} \u0432\u043E \u0432\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435",
      "menu.removeFromScope": "Glossary: \u0443\u0431\u0440\u0430\u0442\u044C {noun} \u0438\u0437 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043D\u0438\u044F",
      "menu.includeInScope": "Glossary: \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u044C {noun} \u0432 \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043D\u0438\u044F",
      "menu.linkScopeThisNote": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C {scope} \xAB{display}\xBB \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043C: \u044D\u0442\u0430 \u0437\u0430\u043C\u0435\u0442\u043A\u0430",
      "menu.linkScopeAllNotes": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C {scope} \xAB{display}\xBB \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043C: \u0432\u0441\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
      "menu.openTitle": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C\u2026",
      "menu.openNewTabTitle": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 \u043D\u043E\u0432\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0435\u2026",
      "exclude.words": "\u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u0441\u043B\u043E\u0432\u0430",
      "exclude.terms": "\u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u044B",
      "exclude.addPrefixed": "Glossary: \u0434\u043E\u0431\u0430\u0432\u0438\u0442\u044C \xAB{value}\xBB \u0432 \u0441\u043F\u0438\u0441\u043E\u043A ({noun})",
      "exclude.removePrefixed": "Glossary: \u0443\u0431\u0440\u0430\u0442\u044C \xAB{value}\xBB \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 ({noun})",
      "exclude.add": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \xAB{value}\xBB \u0432 \u0441\u043F\u0438\u0441\u043E\u043A ({noun})",
      "exclude.remove": "\u0423\u0431\u0440\u0430\u0442\u044C \xAB{value}\xBB \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 ({noun})",
      "notice.indexRebuilt": "Glossary Linker: \u0438\u043D\u0434\u0435\u043A\u0441 \u043F\u0435\u0440\u0435\u0441\u0442\u0440\u043E\u0435\u043D",
      "notice.unlinked": "Glossary Linker: \u0441\u0441\u044B\u043B\u043A\u0430 \u0443\u0431\u0440\u0430\u043D\u0430",
      "notice.noActiveNote": "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0439 \u0437\u0430\u043C\u0435\u0442\u043A\u0438",
      "notice.noSelection": "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043E",
      "notice.noMatches": "Glossary Linker: \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.noGlossaryLinks": "Glossary Linker: \u0441\u0441\u044B\u043B\u043E\u043A \u043D\u0430 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u0439 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.noteChanged": "Glossary Linker: \u0437\u0430\u043C\u0435\u0442\u043A\u0430 \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u0430\u0441\u044C \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430, \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E",
      "notice.scopeWritten": "Glossary Linker: {files}, {links}",
      "notice.scopeSkipped": ", \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E: {n} (\u0438\u0437\u043C\u0435\u043D\u0435\u043D\u043E \u043F\u043E\u0441\u043B\u0435 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0430)",
      "notice.linksCreated": "Glossary Linker: \u0441\u043E\u0437\u0434\u0430\u043D\u043E \u2014 {links}",
      "notice.linksRemoved": "Glossary Linker: \u0443\u0431\u0440\u0430\u043D\u043E \u2014 {links}",
      "notice.linkCreatedSingle": "Glossary Linker: \u0441\u0441\u044B\u043B\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0430",
      "notice.occurrenceNotFound": "Glossary Linker: \u0432\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.noOccurrences": "Glossary Linker: \u0432\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0439 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.scanning": "Glossary Linker: \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435\u2026",
      "notice.scanningProgress": "Glossary Linker: \u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 {current}/{total}\u2026",
      "notice.nothingSelected": "Glossary Linker: \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043E",
      "notice.alreadyMatchesOpened": "Glossary Linker: \xAB{sel}\xBB \u0443\u0436\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \xAB{term}\xBB \u2014 \u043E\u0442\u043A\u0440\u044B\u0442",
      "notice.invalidTermName": "Glossary Linker: \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043D\u0435 \u044F\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u043C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435\u043C \u0442\u0435\u0440\u043C\u0438\u043D\u0430",
      "notice.termExists": "Glossary Linker: \u0442\u0435\u0440\u043C\u0438\u043D \xAB{name}\xBB \u0443\u0436\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u0435\u0442",
      "notice.couldNotCreate": "Glossary Linker: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u043C\u0435\u0442\u043A\u0443 \u0442\u0435\u0440\u043C\u0438\u043D\u0430",
      "notice.templateNotFound": "Glossary Linker: \u0448\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D: {path}",
      "notice.couldNotReadTemplate": "Glossary Linker: \u043D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0448\u0430\u0431\u043B\u043E\u043D",
      "notice.alreadyExcluded": "Glossary Linker: \xAB{value}\xBB \u0443\u0436\u0435 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
      "notice.addedToExcluded": "Glossary Linker: \xAB{value}\xBB \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u0441\u043F\u0438\u0441\u043E\u043A ({where})",
      "notice.wasNotExcluded": "Glossary Linker: \xAB{value}\xBB \u043D\u0435 \u0431\u044B\u043B\u043E \u0432 \u0438\u0441\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F\u0445",
      "notice.removedFromExcluded": "Glossary Linker: \xAB{value}\xBB \u0443\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u0441\u043F\u0438\u0441\u043A\u0430 ({where})",
      "notice.aliasesAdded": "Glossary Linker: \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u2014 {aliases}",
      "notice.noNewAliases": "Glossary Linker: \u043D\u043E\u0432\u044B\u0445 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u0432 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.wordingMatchesTerm": "Glossary Linker: \u044D\u0442\u043E \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0443\u0436\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0442\u0435\u0440\u043C\u0438\u043D\u0443",
      "notice.noNewAlias": "Glossary Linker: \u043D\u0435\u0442 \u043D\u043E\u0432\u043E\u0433\u043E \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u0430 \u0434\u043B\u044F \u0441\u0431\u043E\u0440\u0430",
      "notice.pathAddedExcluded": "Glossary Linker: \xAB{entry}\xBB \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432\u043E \u0432\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u043F\u0443\u0442\u0438",
      "notice.pathRemovedExcluded": "Glossary Linker: \xAB{entry}\xBB \u0443\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u0432\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0445 \u043F\u0443\u0442\u0435\u0439",
      "notice.pathAddedScope": "Glossary Linker: \xAB{entry}\xBB \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E \u0432 \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043D\u0438\u044F",
      "notice.pathRemovedScope": "Glossary Linker: \xAB{entry}\xBB \u0443\u0431\u0440\u0430\u043D\u043E \u0438\u0437 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043D\u0438\u044F",
      "set.heading.collecting": "\u0421\u0431\u043E\u0440 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u0432",
      "set.heading.overview": "\u041E\u0431\u0437\u043E\u0440",
      "set.glossaryFolder.name": "\u041F\u0430\u043F\u043A\u0430 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F",
      "set.glossaryFolder.desc": "\u041F\u0430\u043F\u043A\u0430 \u0441 \u043E\u0434\u043D\u043E\u0439 \u0437\u0430\u043C\u0435\u0442\u043A\u043E\u0439 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D (\u0438\u043C\u044F \u0444\u0430\u0439\u043B\u0430 = \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u0430). \u041E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u043F\u043E\u043B\u0435 \u043F\u0443\u0441\u0442\u044B\u043C \u2014 \u0438 \u0432\u0441\u0451 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u0441\u0442\u0430\u043D\u0435\u0442 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u0435\u043C.",
      "set.termTemplate.name": "\u0428\u0430\u0431\u043B\u043E\u043D \u0442\u0435\u0440\u043C\u0438\u043D\u0430",
      "set.termTemplate.desc": "\u0417\u0430\u043C\u0435\u0442\u043A\u0430, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u043C\u0430\u044F \u043A\u0430\u043A \u0442\u0435\u043B\u043E \u043D\u043E\u0432\u044B\u0445 \u0437\u0430\u043C\u0435\u0442\u043E\u043A \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u0432; \u043F\u043B\u0435\u0439\u0441\u0445\u043E\u043B\u0434\u0435\u0440\u044B \u0432\u0440\u043E\u0434\u0435 {{title}} \u0438 {{date}} \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F. \u041F\u0443\u0441\u0442\u043E = \u043F\u0443\u0441\u0442\u0430\u044F \u0437\u0430\u043C\u0435\u0442\u043A\u0430.",
      "set.scopeMode.name": "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043D\u0438\u044F",
      "set.scopeMode.desc": "\u0412 \u043A\u0430\u043A\u0438\u0445 \u0437\u0430\u043C\u0435\u0442\u043A\u0430\u0445 \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F \u0438 \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u044E\u0442\u0441\u044F.",
      "set.scopeMode.folders": "\u0422\u043E\u043B\u044C\u043A\u043E \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u0435 \u043F\u0443\u0442\u0438",
      "set.scopeMode.vault": "\u0412\u0435\u0437\u0434\u0435",
      "set.scopeFolders.name": "\u0412\u043A\u043B\u044E\u0447\u0430\u0435\u043C\u044B\u0435 \u043F\u0443\u0442\u0438",
      "set.scopeFolders.desc": "\u0424\u0430\u0439\u043B \u0438\u043B\u0438 \u043F\u0430\u043F\u043A\u0430. \u0412 \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043D\u0438\u044F \u0432\u0445\u043E\u0434\u044F\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u043D\u0438 (\u0438 \u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u0432\u043D\u0443\u0442\u0440\u0438 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u044B\u0445 \u043F\u0430\u043F\u043E\u043A).",
      "set.excludeFolders.name": "\u0412\u0441\u0435\u0433\u0434\u0430 \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u043F\u0443\u0442\u0438",
      "set.excludeFolders.desc": "\u0424\u0430\u0439\u043B \u0438\u043B\u0438 \u043F\u0430\u043F\u043A\u0430; \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0438\u0432\u0430\u044E\u0442\u0441\u044F, \u043D\u0435 \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u044E\u0442\u0441\u044F \u0438 \u043D\u0435 \u0441\u043A\u0430\u043D\u0438\u0440\u0443\u044E\u0442\u0441\u044F, \u043D\u0435\u0437\u0430\u0432\u0438\u0441\u0438\u043C\u043E \u043E\u0442 \u0440\u0435\u0436\u0438\u043C\u0430 \u0432\u044B\u0448\u0435.",
      "set.folderList.add": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0443\u0442\u044C\u2026",
      "set.folderList.remove": "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
      "set.folderList.addAria": "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C",
      "set.matchMode.name": "\u041C\u043E\u0440\u0444\u043E\u043B\u043E\u0433\u0438\u044F",
      "set.matchMode.desc": "\u041A\u0430\u043A \u0441\u043B\u043E\u0432\u043E\u0444\u043E\u0440\u043C\u0430 \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u044F\u0435\u0442\u0441\u044F \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043C.",
      "set.matchMode.stemmer": "\u0421\u0442\u0435\u043C\u043C\u0435\u0440 (\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u0443\u0435\u0442\u0441\u044F)",
      "set.matchMode.endingStrip": "\u041E\u0442\u0441\u0435\u0447\u0435\u043D\u0438\u0435 \u043E\u043A\u043E\u043D\u0447\u0430\u043D\u0438\u0439",
      "set.matchMode.exact": "\u0422\u043E\u0447\u043D\u043E\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435",
      "set.minTermLength.name": "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043B\u0438\u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u0430",
      "set.minTermLength.desc": "\u0418\u0433\u043D\u043E\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u043A\u043E\u0440\u043E\u0447\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0433\u043E \u0447\u0438\u0441\u043B\u0430 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432, \u0447\u0442\u043E\u0431\u044B \u043E\u0434\u0438\u043D\u043E\u0447\u043D\u044B\u0435 \u0431\u0443\u043A\u0432\u044B \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u043B\u0438 \u043F\u043E\u0432\u0441\u044E\u0434\u0443.",
      "set.languages.desc": "\u0412\u0441\u0442\u0440\u043E\u0435\u043D\u043D\u044B\u0435 \u043C\u043E\u0434\u0443\u043B\u0438 \u043C\u043E\u0440\u0444\u043E\u043B\u043E\u0433\u0438\u0438 \u2014 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E {enabled} \u0438\u0437 {total}",
      "set.languages.invalidSuffix": ", \u0441 \u043E\u0448\u0438\u0431\u043A\u0430\u043C\u0438: {n}",
      "set.lang.invalid": "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u044B\u0439 \u043C\u043E\u0434\u0443\u043B\u044C: {error}",
      "set.linkFirstOnly.desc": "\u041F\u0440\u0438 \u043F\u0440\u0435\u0432\u0440\u0430\u0449\u0435\u043D\u0438\u0438 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u0432 \u0432 \u0441\u0441\u044B\u043B\u043A\u0438 \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u0435\u0440\u0432\u043E\u0435 \u0432\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u0435 \u043A\u0430\u0436\u0434\u043E\u0433\u043E \u0442\u0435\u0440\u043C\u0438\u043D\u0430 \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435.",
      "set.excludeTerms.name": "\u0418\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u044B",
      "set.excludeTerms.desc": "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u044F \u0438\u043B\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u0432, \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443 \u2014 \u0443\u0431\u0438\u0440\u0430\u044E\u0442 \u0432\u0441\u044E \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0449\u0443\u044E \u0437\u0430\u043F\u0438\u0441\u044C \u0438\u0437 \u0438\u043D\u0434\u0435\u043A\u0441\u0430.",
      "set.excludeWords.name": "\u0418\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u0441\u043B\u043E\u0432\u0430",
      "set.excludeWords.desc": "\u0421\u043B\u043E\u0432\u0430 \u0432 \u0442\u0435\u043A\u0441\u0442\u0435, \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0441\u0442\u0440\u043E\u043A\u0443, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0434\u0430\u044E\u0442 \u0441\u0441\u044B\u043B\u043A\u0443, \u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442 \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043C.",
      "set.highlightInReading.desc": "\u041F\u043E\u0434\u0447\u0451\u0440\u043A\u0438\u0432\u0430\u0442\u044C \u043D\u0430\u0439\u0434\u0435\u043D\u043D\u044B\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u043A\u0430\u043A \u043A\u043B\u0438\u043A\u0430\u0431\u0435\u043B\u044C\u043D\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438 \u0432 \u0440\u0435\u0436\u0438\u043C\u0435 \u0447\u0442\u0435\u043D\u0438\u044F (\u0444\u0430\u0439\u043B \u043D\u0435 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F).",
      "set.editingHighlight.name": "\u041F\u043E\u0434\u0441\u0432\u0435\u0442\u043A\u0430 \u043F\u0440\u0438 \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0438",
      "set.editingHighlight.desc": "\u041F\u043E\u0434\u0447\u0451\u0440\u043A\u0438\u0432\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u0438 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0435 (Live Preview / Source).",
      "set.editingHighlight.off": "\u0412\u044B\u043A\u043B.",
      "set.editingHighlight.live": "\u041D\u0430 \u043B\u0435\u0442\u0443 (\u043F\u043E \u043C\u0435\u0440\u0435 \u043D\u0430\u0431\u043E\u0440\u0430)",
      "set.skipHeadings.desc": "\u041D\u0435 \u043F\u043E\u0434\u0441\u0432\u0435\u0447\u0438\u0432\u0430\u0442\u044C \u0438 \u043D\u0435 \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u0432\u043D\u0443\u0442\u0440\u0438 Markdown-\u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u043E\u0432.",
      "set.statusBar.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 \u0441\u043E\u0441\u0442\u043E\u044F\u043D\u0438\u044F, \u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u0432 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F \u0432 \u0442\u0435\u043A\u0443\u0449\u0435\u0439 \u0437\u0430\u043C\u0435\u0442\u043A\u0435.",
      "set.statusBarIncludeLinks.name": "\u0421\u0447\u0438\u0442\u0430\u0442\u044C \u043F\u0440\u044F\u043C\u044B\u0435 \u0441\u0441\u044B\u043B\u043A\u0438",
      "set.statusBarIncludeLinks.desc": "\u0422\u0430\u043A\u0436\u0435 \u0441\u0447\u0438\u0442\u0430\u0442\u044C \u0443\u0436\u0435 \u0441\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0435 \u0442\u0435\u0440\u043C\u0438\u043D\u044B, \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u0432 \u0442\u0435\u043A\u0441\u0442\u0435.",
      "set.linkSuggest.desc": "\u041F\u043E \u043C\u0435\u0440\u0435 \u043D\u0430\u0431\u043E\u0440\u0430 \u0432 \u0437\u0430\u043C\u0435\u0442\u043A\u0435 \u0438\u0437 \u043E\u0431\u043B\u0430\u0441\u0442\u0438 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0442\u044C \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u044C [[\u0441\u0441\u044B\u043B\u043A\u0443]] \u043D\u0430 \u043F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0439 \u0442\u0435\u0440\u043C\u0438\u043D \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F (\u043F\u043E \u043D\u0430\u0447\u0430\u043B\u0443 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F/\u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u0430 \u0438\u043B\u0438 \u043F\u043E \u0441\u043B\u043E\u0432\u043E\u0444\u043E\u0440\u043C\u0435).",
      "set.suggestMinChars.name": "\u041C\u0438\u043D\u0438\u043C\u0443\u043C \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432",
      "set.suggestSkipAfter.desc": "\u041D\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C, \u0435\u0441\u043B\u0438 \u0441\u043B\u043E\u0432\u043E \u0438\u0434\u0451\u0442 \u0441\u0440\u0430\u0437\u0443 \u043F\u043E\u0441\u043B\u0435 \u043E\u0434\u043D\u043E\u0433\u043E \u0438\u0437 \u044D\u0442\u0438\u0445 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u2014 \u0447\u0442\u043E\u0431\u044B \u0434\u0440\u0443\u0433\u0438\u0435 \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043A\u0438 (\u0442\u0435\u0433\u0438, \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u043A\u043E\u0434, \u0444\u043E\u0440\u043C\u0443\u043B\u044B) \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u043B\u0438 \u0441\u0432\u043E\u0439 \u0441\u043B\u043E\u0442. \u041F\u0443\u0441\u0442\u043E \u2014 \u043E\u0442\u043A\u043B\u044E\u0447\u0438\u0442\u044C.",
      "set.aliasHarvestMode.name": "\u0424\u043E\u0440\u043C\u0430 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u0430",
      "set.aliasHarvestMode.desc": "\u041A\u0430\u043A \u0441\u043E\u0431\u0440\u0430\u043D\u043D\u044B\u0439 \u0442\u0435\u043A\u0441\u0442 \u0441\u0441\u044B\u043B\u043A\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u044F\u0435\u0442\u0441\u044F \u043A\u0430\u043A \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C.",
      "set.aliasHarvestMode.lemma": "\u041D\u0430\u0447\u0430\u043B\u044C\u043D\u0430\u044F \u0444\u043E\u0440\u043C\u0430",
      "set.aliasHarvestMode.literal": "\u041A\u0430\u043A \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043E",
      "set.aliasHarvestMode.both": "\u041E\u0431\u0435",
      "set.harvestOnSave.name": "\u0421\u043E\u0431\u0438\u0440\u0430\u0442\u044C \u043F\u0440\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438",
      "set.harvestOnSave.desc": "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0441\u043E\u0431\u0438\u0440\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u043F\u0440\u0438 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u0438\u0438 \u0437\u0430\u043C\u0435\u0442\u043A\u0438.",
      "set.harvestOnSave.off": "\u0412\u044B\u043A\u043B.",
      "set.harvestOnSave.silent": "\u0422\u0438\u0445\u043E (\u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0442\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438)",
      "set.harvestOnSave.preview": "\u0421\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u0442\u044C",
      "set.harvestSingleWordOnly.name": "\u0422\u043E\u043B\u044C\u043A\u043E \u043E\u0434\u043D\u043E\u0441\u043B\u043E\u0432\u043D\u044B\u0435 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B",
      "set.harvestSingleWordOnly.desc": "\u0421\u043E\u0431\u0438\u0440\u0430\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u0435\u043A\u0441\u0442\u044B \u0441\u0441\u044B\u043B\u043E\u043A \u0438\u0437 \u043E\u0434\u043D\u043E\u0433\u043E \u0441\u043B\u043E\u0432\u0430.",
      "set.harvestMinLength.name": "\u041C\u0438\u043D\u0438\u043C\u0430\u043B\u044C\u043D\u0430\u044F \u0434\u043B\u0438\u043D\u0430 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u0430",
      "set.harvestMinLength.desc": "\u0418\u0433\u043D\u043E\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0441\u043E\u0431\u0440\u0430\u043D\u043D\u044B\u0435 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u043A\u043E\u0440\u043E\u0447\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043D\u043E\u0433\u043E \u0447\u0438\u0441\u043B\u0430 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432.",
      "set.aliasCollisionWarnings.name": "\u041F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0436\u0434\u0430\u0442\u044C \u043E \u043A\u043E\u043D\u0444\u043B\u0438\u043A\u0442\u0430\u0445 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u0432",
      "set.aliasCollisionWarnings.desc": "\u041F\u0440\u0438 \u0441\u0431\u043E\u0440\u0435 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u0430 \u0438\u043B\u0438 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u0438 \u0442\u0435\u0440\u043C\u0438\u043D\u0430 \u043E\u0442\u043C\u0435\u0447\u0430\u0442\u044C \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u0435, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0443\u0436\u0435 \u0441\u043E\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0443\u0435\u0442 \u0434\u0440\u0443\u0433\u043E\u043C\u0443 \u0442\u0435\u0440\u043C\u0438\u043D\u0443 (\u0447\u0442\u043E\u0431\u044B \u0441\u043B\u043E\u0432\u043E \u043D\u0435 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u043B\u043E \u043D\u0430 \u0434\u0432\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u0430).",
      "set.menuTurnInto.name": "\u041F\u0443\u043D\u043A\u0442\u044B \xAB\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043C\xBB",
      "set.menuTurnInto.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C \u043C\u0435\u043D\u044E \u0442\u0435\u0440\u043C\u0438\u043D\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \xAB\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043C\xBB / \xAB\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0432\u0441\u0435 \u2026 \u0441 \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u043C\xBB.",
      "set.menuCollect.name": "\u041F\u0443\u043D\u043A\u0442 \xAB\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B\xBB",
      "set.menuCollect.desc": "\u041F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0442\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0442\u0435\u043A\u0441\u0442 \u0441\u0441\u044B\u043B\u043A\u0438 \u043A\u0430\u043A \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C \u2014 \u043D\u0430 \u0441\u0430\u043C\u043E\u0439 \u0441\u0441\u044B\u043B\u043A\u0435 \u0438 \u0434\u043B\u044F \u0432\u0441\u0435\u0439 \u0437\u0430\u043C\u0435\u0442\u043A\u0438 \u0438\u0437 \u0435\u0451 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u0433\u043E \u043C\u0435\u043D\u044E.",
      "set.menuExclude.name": "\u041F\u0443\u043D\u043A\u0442\u044B \xAB\u0418\u0441\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u0441\u043B\u043E\u0432\u043E / \u0442\u0435\u0440\u043C\u0438\u043D\xBB",
      "set.menuExclude.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C \u043C\u0435\u043D\u044E \u043F\u0443\u043D\u043A\u0442\u044B \xAB\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u2026 \u0432 \u0438\u0441\u043A\u043B\u044E\u0447\u0451\u043D\u043D\u044B\u0435 \u0441\u043B\u043E\u0432\u0430 / \u0442\u0435\u0440\u043C\u0438\u043D\u044B\xBB.",
      "set.menuOpen.name": "\u041F\u0443\u043D\u043A\u0442\u044B \xAB\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u043C\u0435\u0442\u043A\u0443 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F\xBB",
      "set.menuOpen.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C \u043C\u0435\u043D\u044E \u0442\u0435\u0440\u043C\u0438\u043D\u0430 \xAB\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0437\u0430\u043C\u0435\u0442\u043A\u0443 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F\xBB / \xAB\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 \u043D\u043E\u0432\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0435\xBB.",
      "set.menuCreateTerm.name": "\u041F\u0443\u043D\u043A\u0442\u044B \xAB\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D \u0438\u0437 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u044F\xBB",
      "set.menuCreateTerm.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C \u043C\u0435\u043D\u044E \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \xABGlossary: \u0441\u043E\u0437\u0434\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u2026\xBB.",
      "set.menuAddAlias.name": "\u041F\u0443\u043D\u043A\u0442 \xAB\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u043C \u0442\u0435\u0440\u043C\u0438\u043D\u0430\xBB",
      "set.menuAddAlias.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C \u043C\u0435\u043D\u044E \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0430 \u043F\u0443\u043D\u043A\u0442, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043F\u0440\u0438\u0432\u044F\u0437\u044B\u0432\u0430\u0435\u0442 \u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435 \u043A\u0430\u043A \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C \u043A \u0432\u044B\u0431\u0440\u0430\u043D\u043D\u043E\u043C\u0443 \u0442\u0435\u0440\u043C\u0438\u043D\u0443.",
      "set.menuUnlink.name": "\u041F\u0443\u043D\u043A\u0442 \xAB\u0423\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\xBB",
      "set.menuUnlink.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C \u043C\u0435\u043D\u044E \u0441\u0441\u044B\u043B\u043A\u0438 \xABGlossary: \u0443\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0443 \u043D\u0430 \u044D\u0442\u043E\u0442 \u0442\u0435\u0440\u043C\u0438\u043D\xBB.",
      "set.showRibbonIcon.name": "\u0417\u043D\u0430\u0447\u043E\u043A \u043D\u0430 \u043F\u0430\u043D\u0435\u043B\u0438",
      "set.showRibbonIcon.desc": "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0430 \u0431\u043E\u043A\u043E\u0432\u043E\u0439 \u043F\u0430\u043D\u0435\u043B\u0438, \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u044E\u0449\u0443\u044E \u043E\u0431\u0437\u043E\u0440 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \xAB\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043E\u0431\u0437\u043E\u0440 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F\xBB \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u0432 \u043B\u044E\u0431\u043E\u043C \u0441\u043B\u0443\u0447\u0430\u0435.",
      "set.rebuild.name": "\u041F\u0435\u0440\u0435\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u0438\u043D\u0434\u0435\u043A\u0441 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F",
      "set.rebuild.desc": "\u041F\u0435\u0440\u0435\u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u0430\u043F\u043A\u0443 \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F \u0441\u0435\u0439\u0447\u0430\u0441.",
      "set.collecting.desc": "\u0427\u0438\u0442\u0430\u0435\u0442 \u0441\u0441\u044B\u043B\u043A\u0438, \u043A\u043E\u0442\u043E\u0440\u044B\u0435 \u0432\u044B \u0441\u0434\u0435\u043B\u0430\u043B\u0438 \u0432\u0440\u0443\u0447\u043D\u0443\u044E, \u0432\u0438\u0434\u0430 [[\u0422\u0435\u0440\u043C\u0438\u043D|\u043A\u0430\u043A\u043E\u0435-\u0442\u043E \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u0435]], \u0438 \u0434\u043E\u0431\u0430\u0432\u043B\u044F\u0435\u0442 \u044D\u0442\u043E \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0432 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u0442\u0435\u0440\u043C\u0438\u043D\u0430 \u2014 \u0447\u0442\u043E\u0431\u044B \u0442\u043E \u0436\u0435 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043B\u043E\u0441\u044C \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0437.",
      "set.folderNotFound": "\u26A0 \u041F\u0430\u043F\u043A\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u2014 \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u043D\u0435 \u0431\u0443\u0434\u0443\u0442 \u043F\u0440\u043E\u0438\u043D\u0434\u0435\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u044B.",
      "set.termsIndexed": "\u041F\u0440\u043E\u0438\u043D\u0434\u0435\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043E: {terms}.",
      "set.wholeVaultStatus": "\u0413\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u0439 \u2014 \u0432\u0441\u0451 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435. \u041F\u0440\u043E\u0438\u043D\u0434\u0435\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u043E: {terms}.",
      "modal.materialize.title": "\u0421\u0432\u044F\u0437\u0430\u0442\u044C \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u0433\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u044F \u2014 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
      "modal.materialize.summary": "\u0424\u0430\u0439\u043B\u043E\u0432: {files}, \u0437\u0430\u043C\u0435\u043D: {replacements}",
      "modal.materialize.ambiguous": "\u041D\u0435\u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u043D\u044B\u0445 \u0441\u043B\u043E\u0432, \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0449\u0438\u0445 \u0441 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u0438\u043C\u0438 \u0442\u0435\u0440\u043C\u0438\u043D\u0430\u043C\u0438: {n} \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043E\u0434\u043D\u043E (\u043F\u0440\u0438\u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043A\u043E \u0432\u0441\u0435\u043C \u0432\u0445\u043E\u0436\u0434\u0435\u043D\u0438\u044F\u043C):",
      "modal.skipOption": "(\u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u2014 \u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0442\u0435\u043A\u0441\u0442\u043E\u043C)",
      "modal.leftAsText": "\u2014 \u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E \u0442\u0435\u043A\u0441\u0442\u043E\u043C \u2014",
      "modal.harvest.title": "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u2014 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
      "modal.harvest.summary": "\u0422\u0435\u0440\u043C\u0438\u043D\u043E\u0432: {terms}, \u043D\u043E\u0432\u044B\u0445 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u0432: {aliases}",
      "modal.harvest.alsoMatches": "\u0422\u0430\u043A\u0436\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441: {terms}",
      "modal.harvest.alreadyPresent": "\u0423\u0436\u0435 \u0435\u0441\u0442\u044C (\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E): {items}",
      "modal.unlink.title": "\u0423\u0431\u0440\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0438 \u043D\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u044B \u2014 \u043F\u0440\u0435\u0434\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440",
      "modal.unlink.summary": "\u0424\u0430\u0439\u043B\u043E\u0432: {files}, \u0441\u0441\u044B\u043B\u043E\u043A \u043A \u0443\u0434\u0430\u043B\u0435\u043D\u0438\u044E: {links}",
      "modal.choose.body": "\u0423 \u044D\u0442\u043E\u0433\u043E \u0441\u043B\u043E\u0432\u0430 \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0439 \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043E\u0434\u043D\u043E:",
      "modal.alias.pickTerm": "\u041A \u043A\u0430\u043A\u043E\u043C\u0443 \u0442\u0435\u0440\u043C\u0438\u043D\u0443 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C?",
      "modal.alias.title": "\u041F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C \u0434\u043B\u044F \xAB{term}\xBB",
      "modal.alias.body": "\u0424\u043E\u0440\u043C\u0430, \u043A\u043E\u0442\u043E\u0440\u0443\u044E \u0441\u0442\u0435\u043C\u043C\u0435\u0440 \u043D\u0435 \u0432\u044B\u0432\u0435\u0434\u0435\u0442 \u0438\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F: \u0441\u043E\u043A\u0440\u0430\u0449\u0435\u043D\u0438\u0435 (\u0426\u041D\u0421, \u0412\u041D\u0421), \u0441\u0438\u043D\u043E\u043D\u0438\u043C \u0438\u043B\u0438 \u0434\u0440\u0443\u0433\u043E\u0435 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u0438\u0435. \u0421\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0431\u0443\u043A\u0432\u0430\u043B\u044C\u043D\u043E, \u043F\u043E\u044D\u0442\u043E\u043C\u0443 \u0432\u0432\u043E\u0434\u0438\u0442\u0435 \u043A\u0430\u043A \u0435\u0441\u0442\u044C.",
      "notice.noTerms": "\u0412 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u043D\u0438 \u043E\u0434\u043D\u043E\u0433\u043E \u0442\u0435\u0440\u043C\u0438\u043D\u0430.",
      "notice.aliasExists": "\xAB{alias}\xBB \u0443\u0436\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D \u043A \xAB{term}\xBB.",
      "notice.aliasAdded": "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C \xAB{alias}\xBB \u2192 \xAB{term}\xBB.",
      "notice.aliasAddedCollision": "\u0414\u043E\u0431\u0430\u0432\u043B\u0435\u043D \xAB{alias}\xBB \u2192 \xAB{term}\xBB, \u043D\u043E \u043E\u043D \u0443\u0436\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u0435\u0442 \u0441: {others}.",
      "notice.termFileMissing": "\u0417\u0430\u043C\u0435\u0442\u043A\u0430 \u0442\u0435\u0440\u043C\u0438\u043D\u0430 \xAB{term}\xBB \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430 \u2014 \u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E, \u0435\u0451 \u043F\u0435\u0440\u0435\u043C\u0435\u0441\u0442\u0438\u043B\u0438 \u0438\u043B\u0438 \u0443\u0434\u0430\u043B\u0438\u043B\u0438.",
      "btn.write": "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C",
      "label.selection": "\u0432\u044B\u0434\u0435\u043B\u0435\u043D\u0438\u0435",
      "view.title": "\u0413\u043B\u043E\u0441\u0441\u0430\u0440\u0438\u0439",
      "overview.rescan": "\u041F\u0435\u0440\u0435\u0441\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C",
      "overview.wholeVault": "\u0432\u0441\u0451 \u0445\u0440\u0430\u043D\u0438\u043B\u0438\u0449\u0435",
      "overview.wholeVaultAria": "\u0421\u043A\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0432\u0441\u0435 \u0437\u0430\u043C\u0435\u0442\u043A\u0438, \u0430 \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u0441\u0432\u044F\u0437\u044B\u0432\u0430\u043D\u0438\u044F",
      "overview.terms": "\u0422\u0435\u0440\u043C\u0438\u043D\u044B",
      "overview.candidates": "\u041A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u044B",
      "overview.sort": "\u0421\u043E\u0440\u0442\u0438\u0440\u043E\u0432\u043A\u0430",
      "overview.sortMostUsed": "\u041F\u043E \u0447\u0430\u0441\u0442\u043E\u0442\u0435",
      "overview.sortName": "\u041F\u043E \u0438\u043C\u0435\u043D\u0438",
      "overview.countLinks": "\u0441\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0441\u044B\u043B\u043A\u0438",
      "overview.countLinksAria": "\u0422\u0430\u043A\u0436\u0435 \u0441\u0447\u0438\u0442\u0430\u0442\u044C \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u0441\u0441\u044B\u043B\u043A\u0438 [[\u0422\u0435\u0440\u043C\u0438\u043D]], \u043D\u0435 \u0442\u043E\u043B\u044C\u043A\u043E \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F \u0432 \u0442\u0435\u043A\u0441\u0442\u0435",
      "overview.noTerms": "\u0422\u0435\u0440\u043C\u0438\u043D\u044B \u043D\u0435 \u043F\u0440\u043E\u0438\u043D\u0434\u0435\u043A\u0441\u0438\u0440\u043E\u0432\u0430\u043D\u044B.",
      "overview.openAria": "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u2014 \u0441\u0440\u0435\u0434\u043D\u0438\u0439 \u043A\u043B\u0438\u043A \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0439 \u0432\u043A\u043B\u0430\u0434\u043A\u0438",
      "overview.unused": "\u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u26A0",
      "overview.linkAll": "\u0441\u0432\u044F\u0437\u0430\u0442\u044C \u0432\u0441\u0435",
      "overview.sortNotes": "\u041F\u043E \u0437\u0430\u043C\u0435\u0442\u043A\u0430\u043C",
      "overview.sortMentions": "\u041F\u043E \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F\u043C",
      "overview.minNotes": "\u041C\u0438\u043D. \u0437\u0430\u043C\u0435\u0442\u043E\u043A",
      "overview.noCandidates": "\u041A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u043E\u0432 \u043D\u0435\u0442.",
      "overview.addTerm": "+ \u0442\u0435\u0440\u043C\u0438\u043D",
      "suggest.inflection": "\u0441\u043B\u043E\u0432\u043E\u0444\u043E\u0440\u043C\u0430",
      "suggest.alias": "\u043A\u0430\u043A \xAB{form}\xBB",
      "plural.term": { one: "{n} \u0442\u0435\u0440\u043C\u0438\u043D", few: "{n} \u0442\u0435\u0440\u043C\u0438\u043D\u0430", many: "{n} \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u0432", other: "{n} \u0442\u0435\u0440\u043C\u0438\u043D\u043E\u0432" },
      "plural.use": { one: "{n} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0435", few: "{n} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u044F", many: "{n} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0439", other: "{n} \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u043D\u0438\u0439" },
      "plural.note": { one: "{n} \u0437\u0430\u043C\u0435\u0442\u043A\u0430", few: "{n} \u0437\u0430\u043C\u0435\u0442\u043A\u0438", many: "{n} \u0437\u0430\u043C\u0435\u0442\u043E\u043A", other: "{n} \u0437\u0430\u043C\u0435\u0442\u043E\u043A" },
      "plural.link": { one: "{n} \u0441\u0441\u044B\u043B\u043A\u0430", few: "{n} \u0441\u0441\u044B\u043B\u043A\u0438", many: "{n} \u0441\u0441\u044B\u043B\u043E\u043A", other: "{n} \u0441\u0441\u044B\u043B\u043E\u043A" },
      "plural.file": { one: "{n} \u0444\u0430\u0439\u043B", few: "{n} \u0444\u0430\u0439\u043B\u0430", many: "{n} \u0444\u0430\u0439\u043B\u043E\u0432", other: "{n} \u0444\u0430\u0439\u043B\u043E\u0432" },
      "plural.alias": { one: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C", few: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u0430", many: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u0432", other: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u043E\u0432" }
    };
  }
});

// src/locales/de.js
var require_de2 = __commonJS({
  "src/locales/de.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      "cmd.openOverview": "Glossar-\xDCbersicht \xF6ffnen",
      "cmd.linkThisNote": "Glossarbegriffe verlinken: diese Notiz",
      "cmd.linkSelection": "Glossarbegriffe verlinken: Auswahl",
      "cmd.linkAllNotes": "Glossarbegriffe verlinken: alle Notizen",
      "cmd.unlinkThisNote": "Glossarbegriffe entlinken: diese Notiz",
      "cmd.unlinkSelection": "Glossarbegriffe entlinken: Auswahl",
      "cmd.unlinkAllNotes": "Glossarbegriffe entlinken: alle Notizen",
      "cmd.collectThisNote": "Aliasse aus Links sammeln: diese Notiz",
      "cmd.collectAllNotes": "Aliasse aus Links sammeln: alle Notizen",
      "cmd.createTerm": "Glossarbegriff aus Auswahl erstellen",
      "cmd.rebuildIndex": "Glossar-Index neu aufbauen",
      "ribbon.tooltip": "Glossar-\xDCbersicht",
      "statusBar.aria": "{n} Glossarbegriff(e) auf dieser Seite \u2014 zum Verlinken klicken",
      "menu.createTermLink": "Glossary: Begriff erstellen & verlinken",
      "menu.createTerm": "Glossary: Begriff erstellen",
      "menu.unlinkThisTerm": "Glossary: diesen Begriff entlinken",
      "menu.collectThisAlias": "Glossary: diesen Alias sammeln",
      "menu.collectFromNote": "Glossary: Aliasse aus Links sammeln (diese Notiz)",
      "menu.removeFromAlwaysExcluded": "Glossary: aus \u201Eimmer ausgeschlossen\u201C entfernen",
      "menu.addToAlwaysExcluded": "Glossary: {noun} zu \u201Eimmer ausgeschlossen\u201C hinzuf\xFCgen",
      "menu.removeFromScope": "Glossary: {noun} aus dem Bereich entfernen",
      "menu.includeInScope": "Glossary: {noun} in den Bereich aufnehmen",
      "menu.linkToTerm": "Mit Begriff verlinken",
      "menu.linkScopeThisNote": "{scope} \u201E{display}\u201C mit Begriff verlinken: diese Notiz",
      "menu.linkScopeAllNotes": "{scope} \u201E{display}\u201C mit Begriff verlinken: alle Notizen",
      "menu.openNote": "Glossarnotiz \xF6ffnen",
      "menu.openNewTab": "In neuem Tab \xF6ffnen",
      "menu.openTitle": "\xD6ffnen\u2026",
      "menu.openNewTabTitle": "In neuem Tab \xF6ffnen\u2026",
      "exclude.words": "ausgeschlossene W\xF6rter",
      "exclude.terms": "ausgeschlossene Begriffe",
      "exclude.addPrefixed": "Glossary: \u201E{value}\u201C zu {noun} hinzuf\xFCgen",
      "exclude.removePrefixed": "Glossary: \u201E{value}\u201C aus {noun} entfernen",
      "exclude.add": "\u201E{value}\u201C zu {noun} hinzuf\xFCgen",
      "exclude.remove": "\u201E{value}\u201C aus {noun} entfernen",
      "notice.indexRebuilt": "Glossary Linker: Index neu aufgebaut",
      "notice.unlinked": "Glossary Linker: entlinkt",
      "notice.noActiveNote": "Keine aktive Notiz",
      "notice.noSelection": "Keine Auswahl",
      "notice.noMatches": "Glossary Linker: keine Treffer gefunden",
      "notice.noGlossaryLinks": "Glossary Linker: keine Glossar-Links gefunden",
      "notice.noteChanged": "Glossary Linker: Notiz seit der Vorschau ge\xE4ndert, nichts geschrieben",
      "notice.scopeWritten": "Glossary Linker: {files}, {links}",
      "notice.scopeSkipped": ", {n} \xFCbersprungen (seit der Vorschau ge\xE4ndert)",
      "notice.linksCreated": "Glossary Linker: {links} erstellt",
      "notice.linksRemoved": "Glossary Linker: {links} entfernt",
      "notice.linkCreatedSingle": "Glossary Linker: Link erstellt",
      "notice.occurrenceNotFound": "Glossary Linker: Vorkommen nicht gefunden",
      "notice.noOccurrences": "Glossary Linker: keine Vorkommen gefunden",
      "notice.scanning": "Glossary Linker: scanne\u2026",
      "notice.scanningProgress": "Glossary Linker: scanne {current}/{total}\u2026",
      "notice.nothingSelected": "Glossary Linker: nichts ausgew\xE4hlt",
      "notice.alreadyMatchesOpened": "Glossary Linker: \u201E{sel}\u201C passt bereits zu \u201E{term}\u201C \u2014 ge\xF6ffnet",
      "notice.invalidTermName": "Glossary Linker: Auswahl ist kein g\xFCltiger Begriffsname",
      "notice.termExists": "Glossary Linker: Begriff \u201E{name}\u201C existiert bereits",
      "notice.couldNotCreate": "Glossary Linker: Begriffsnotiz konnte nicht erstellt werden",
      "notice.templateNotFound": "Glossary Linker: Vorlage nicht gefunden: {path}",
      "notice.couldNotReadTemplate": "Glossary Linker: Vorlage konnte nicht gelesen werden",
      "notice.alreadyExcluded": "Glossary Linker: \u201E{value}\u201C ist bereits ausgeschlossen",
      "notice.addedToExcluded": "Glossary Linker: \u201E{value}\u201C zu {where} hinzugef\xFCgt",
      "notice.wasNotExcluded": "Glossary Linker: \u201E{value}\u201C war nicht ausgeschlossen",
      "notice.removedFromExcluded": "Glossary Linker: \u201E{value}\u201C aus {where} entfernt",
      "notice.aliasesAdded": "Glossary Linker: {aliases} hinzugef\xFCgt",
      "notice.noNewAliases": "Glossary Linker: keine neuen Aliasse gefunden",
      "notice.wordingMatchesTerm": "Glossary Linker: dieser Wortlaut passt bereits zum Begriff",
      "notice.noNewAlias": "Glossary Linker: kein neuer Alias zu sammeln",
      "notice.pathAddedExcluded": "Glossary Linker: \u201E{entry}\u201C zu \u201Eimmer ausgeschlossen\u201C hinzugef\xFCgt",
      "notice.pathRemovedExcluded": "Glossary Linker: \u201E{entry}\u201C aus \u201Eimmer ausgeschlossen\u201C entfernt",
      "notice.pathAddedScope": "Glossary Linker: \u201E{entry}\u201C zu Bereichspfaden hinzugef\xFCgt",
      "notice.pathRemovedScope": "Glossary Linker: \u201E{entry}\u201C aus Bereichspfaden entfernt",
      "set.heading.collecting": "Aliasse sammeln",
      "set.heading.overview": "\xDCbersicht",
      "set.glossaryFolder.name": "Glossar-Ordner",
      "set.glossaryFolder.desc": "Ordner mit einer Notiz pro Begriff (Dateiname = Begriffstitel).",
      "set.termTemplate.name": "Begriffsvorlage",
      "set.termTemplate.desc": "Notiz, die als Inhalt neuer Begriffsnotizen dient; Platzhalter wie {{title}} und {{date}} werden ausgef\xFCllt. Leer = leere Notiz.",
      "set.scopeMode.name": "Verlinkungsbereich",
      "set.scopeMode.desc": "In welchen Notizen Begriffe hervorgehoben und verlinkt werden.",
      "set.scopeMode.folders": "Nur aufgef\xFChrte Pfade",
      "set.scopeMode.vault": "\xDCberall",
      "set.scopeFolders.name": "Einzuschlie\xDFende Pfade",
      "set.scopeFolders.desc": "Eine Datei oder ein Ordner. Nur diese (und Notizen in aufgef\xFChrten Ordnern) sind im Bereich.",
      "set.excludeFolders.name": "Immer ausgeschlossene Pfade",
      "set.excludeFolders.desc": "Eine Datei oder ein Ordner, nie hervorgehoben, verlinkt oder gescannt, egal welcher Modus oben gilt.",
      "set.matchMode.name": "Morphologie",
      "set.matchMode.desc": "Wie ein flektiertes Wort einem Begriff zugeordnet wird.",
      "set.matchMode.stemmer": "Stemmer (empfohlen)",
      "set.matchMode.endingStrip": "Endungen abschneiden",
      "set.matchMode.exact": "Exakter Treffer",
      "set.minTermLength.name": "Minimale Begriffsl\xE4nge",
      "set.minTermLength.desc": "Begriffstitel und Aliasse, die k\xFCrzer als diese Zeichenzahl sind, ignorieren, damit einzelne Buchstaben nicht \xFCberall treffen.",
      "set.languages.desc": "Mitgelieferte Morphologie-Module \u2014 {enabled} von {total} aktiviert",
      "set.languages.invalidSuffix": ", {n} ung\xFCltig",
      "set.lang.invalid": "Ung\xFCltiges Modul: {error}",
      "set.linkFirstOnly.desc": "Beim Umwandeln von Begriffen in Links nur das erste Vorkommen jedes Begriffs auf einer Seite verlinken.",
      "set.excludeTerms.name": "Ausgeschlossene Begriffe",
      "set.excludeTerms.desc": "Begriffstitel oder Aliasse, einer pro Zeile \u2014 entfernt den gesamten passenden Eintrag aus dem Index.",
      "set.excludeWords.name": "Ausgeschlossene W\xF6rter",
      "set.excludeWords.desc": "W\xF6rter im Text, eines pro Zeile, die nie einen Link ausl\xF6sen, auch wenn sie zu einem Begriff passen.",
      "set.highlightInReading.desc": "Erkannte Begriffe in der Leseansicht als klickbare Links unterstreichen (Datei unver\xE4ndert).",
      "set.editingHighlight.name": "Beim Bearbeiten hervorheben",
      "set.editingHighlight.desc": "Begriffe auch im Editor (Live-Vorschau / Quelltext) unterstreichen.",
      "set.editingHighlight.off": "Aus",
      "set.editingHighlight.live": "Live (w\xE4hrend der Eingabe)",
      "set.skipHeadings.desc": "Begriffe in Markdown-\xDCberschriften nicht hervorheben oder verlinken.",
      "set.statusBar.desc": "In der Statusleiste anzeigen, wie viele Glossarbegriffe in der aktuellen Notiz sind.",
      "set.statusBarIncludeLinks.name": "Direkte Links z\xE4hlen",
      "set.statusBarIncludeLinks.desc": "Auch bereits direkt verlinkte Begriffe z\xE4hlen, nicht nur Erw\xE4hnungen im Text.",
      "set.linkSuggest.desc": "W\xE4hrend der Eingabe in einer Notiz im Bereich anbieten, einen [[Link]] zu einem passenden Glossarbegriff einzuf\xFCgen (Pr\xE4fix eines Titels/Alias oder eine flektierte Form).",
      "set.suggestMinChars.name": "Mindestanzahl Zeichen",
      "set.suggestSkipAfter.desc": "Keine Vorschl\xE4ge, wenn das Wort direkt auf eines dieser Zeichen folgt, damit andere Autovervollst\xE4ndigungen (Tags, Code-Links, Mathe) ihren Platz behalten. Leer lassen zum Deaktivieren.",
      "set.aliasHarvestMode.name": "Aliasform",
      "set.aliasHarvestMode.desc": "Wie gesammelter Linktext als Alias gespeichert wird.",
      "set.aliasHarvestMode.lemma": "Grundform",
      "set.aliasHarvestMode.literal": "Wie geschrieben",
      "set.aliasHarvestMode.both": "Beide",
      "set.harvestOnSave.name": "Beim Speichern sammeln",
      "set.harvestOnSave.desc": "Aliasse automatisch sammeln, wenn eine Notiz gespeichert wird.",
      "set.harvestOnSave.off": "Aus",
      "set.harvestOnSave.silent": "Still (automatisch hinzuf\xFCgen)",
      "set.harvestOnSave.preview": "Vorher fragen",
      "set.harvestSingleWordOnly.name": "Nur einwortige Aliasse",
      "set.harvestSingleWordOnly.desc": "Nur Linktexte sammeln, die ein einzelnes Wort sind.",
      "set.harvestMinLength.name": "Minimale Aliasl\xE4nge",
      "set.harvestMinLength.desc": "Gesammelte Aliasse ignorieren, die k\xFCrzer als diese Zeichenzahl sind.",
      "set.aliasCollisionWarnings.name": "Vor Alias-Konflikten warnen",
      "set.aliasCollisionWarnings.desc": "Beim Sammeln eines Alias oder Erstellen eines Begriffs einen Wortlaut markieren, der bereits zu einem anderen Begriff passt (damit ein Wort nicht auf zwei Begriffe zeigt).",
      "set.menuTurnInto.name": "\u201EMit Begriff verlinken\u201C-Eintr\xE4ge",
      "set.menuTurnInto.desc": "Die Aktionen \u201EMit Begriff verlinken\u201C / \u201EAlle \u2026 mit Begriff verlinken\u201C im Kontextmen\xFC eines hervorgehobenen Begriffs anzeigen.",
      "set.menuCollect.name": "\u201EAliasse sammeln\u201C-Eintrag",
      "set.menuCollect.desc": "\u201EAliasse aus Links sammeln (diese Notiz)\u201C im Kontextmen\xFC des Editors anzeigen.",
      "set.menuExclude.name": "\u201EWort / Begriff ausschlie\xDFen\u201C-Eintr\xE4ge",
      "set.menuExclude.desc": "\u201E\u2026 zu ausgeschlossenen W\xF6rtern / Begriffen hinzuf\xFCgen\u201C im Kontextmen\xFC anzeigen.",
      "set.menuOpen.name": "\u201EGlossarnotiz \xF6ffnen\u201C-Eintr\xE4ge",
      "set.menuOpen.desc": "\u201EGlossarnotiz \xF6ffnen\u201C / \u201EIn neuem Tab \xF6ffnen\u201C im Kontextmen\xFC eines hervorgehobenen Begriffs anzeigen.",
      "set.menuCreateTerm.name": "\u201EBegriff aus Auswahl erstellen\u201C-Eintr\xE4ge",
      "set.menuCreateTerm.desc": "Die Aktionen \u201EGlossary: Begriff erstellen\u2026\u201C im Kontextmen\xFC einer Textauswahl anzeigen.",
      "set.menuUnlink.name": "\u201EBegriff entlinken\u201C-Eintrag",
      "set.menuUnlink.desc": "\u201EGlossary: diesen Begriff entlinken\u201C im Kontextmen\xFC eines vorhandenen Glossar-Links anzeigen.",
      "set.showRibbonIcon.name": "Seitenleisten-Symbol",
      "set.showRibbonIcon.desc": "Eine Schaltfl\xE4che in der Seitenleiste anzeigen, die die Glossar-\xDCbersicht \xF6ffnet. Der Befehl \u201EGlossar-\xDCbersicht \xF6ffnen\u201C funktioniert ohnehin.",
      "set.rebuild.name": "Glossar-Index neu aufbauen",
      "set.rebuild.desc": "Den Glossar-Ordner jetzt neu scannen.",
      "set.collecting.desc": "Liest die Links, die Sie von Hand erstellt haben, wie [[Begriff|ein Wortlaut]], und f\xFCgt diesen Wortlaut den Aliassen des Begriffs hinzu \u2014 damit derselbe Wortlaut beim n\xE4chsten Mal automatisch verlinkt wird.",
      "set.folderNotFound": "\u26A0 Ordner nicht gefunden \u2014 es werden keine Begriffe indexiert.",
      "set.termsIndexed": "{terms} indexiert.",
      "modal.materialize.title": "Glossarbegriffe verlinken \u2014 Vorschau",
      "modal.materialize.summary": "Dateien: {files}, Ersetzungen: {replacements}",
      "modal.materialize.ambiguous": "{n} mehrdeutige(s) Wort(e) passen zu mehr als einem Begriff \u2014 eines w\xE4hlen (gilt f\xFCr jedes Vorkommen):",
      "modal.skipOption": "(\xFCberspringen \u2014 als Text belassen)",
      "modal.leftAsText": "\u2014 als Text belassen \u2014",
      "modal.harvest.title": "Aliasse sammeln \u2014 Vorschau",
      "modal.harvest.summary": "Begriffe: {terms}, neue Aliasse: {aliases}",
      "modal.harvest.alsoMatches": "Passt auch zu: {terms}",
      "modal.harvest.alreadyPresent": "Bereits vorhanden (\xFCbersprungen): {items}",
      "modal.unlink.title": "Glossarbegriffe entlinken \u2014 Vorschau",
      "modal.unlink.summary": "Dateien: {files}, zu entfernende Links: {links}",
      "modal.choose.body": "Dieses Wort passt zu mehr als einem Begriff \u2014 eines w\xE4hlen:",
      "btn.write": "Schreiben",
      "label.selection": "Auswahl",
      "view.title": "Glossar",
      "overview.rescan": "Neu scannen",
      "overview.wholeVault": "gesamter Tresor",
      "overview.wholeVaultAria": "Jede Notiz scannen, nicht nur den Linker-Bereich",
      "overview.terms": "Begriffe",
      "overview.candidates": "Kandidaten",
      "overview.sort": "Sortieren",
      "overview.sortMostUsed": "Meistgenutzt",
      "overview.sortName": "Name",
      "overview.countLinks": "Links z\xE4hlen",
      "overview.countLinksAria": "Auch vorhandene [[Begriff]]-Links z\xE4hlen, nicht nur Erw\xE4hnungen im Text",
      "overview.noTerms": "Keine Begriffe indexiert.",
      "overview.openAria": "\xD6ffnen \u2014 mittlere Maustaste f\xFCr neuen Tab",
      "overview.unused": "ungenutzt \u26A0",
      "overview.linkAll": "alle verlinken",
      "overview.sortNotes": "Notizen",
      "overview.sortMentions": "Erw\xE4hnungen",
      "overview.minNotes": "Min. Notizen",
      "overview.noCandidates": "Keine Kandidaten.",
      "overview.addTerm": "+ Begriff",
      "suggest.inflection": "Flexion",
      "suggest.alias": "Alias: {form}",
      "highlight.matches": "Passt zu: {terms}",
      "plural.term": { one: "{n} Begriff", other: "{n} Begriffe" },
      "plural.use": { one: "{n} Nutzung", other: "{n} Nutzungen" },
      "plural.note": { one: "{n} Notiz", other: "{n} Notizen" },
      "plural.link": { one: "{n} Link", other: "{n} Links" },
      "plural.file": { one: "{n} Datei", other: "{n} Dateien" },
      "plural.alias": { one: "{n} Alias", other: "{n} Aliasse" }
    };
  }
});

// src/locales/es.js
var require_es2 = __commonJS({
  "src/locales/es.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      "cmd.openOverview": "Abrir resumen del glosario",
      "cmd.linkThisNote": "Enlazar t\xE9rminos del glosario: esta nota",
      "cmd.linkSelection": "Enlazar t\xE9rminos del glosario: selecci\xF3n",
      "cmd.linkAllNotes": "Enlazar t\xE9rminos del glosario: todas las notas",
      "cmd.unlinkThisNote": "Desenlazar t\xE9rminos del glosario: esta nota",
      "cmd.unlinkSelection": "Desenlazar t\xE9rminos del glosario: selecci\xF3n",
      "cmd.unlinkAllNotes": "Desenlazar t\xE9rminos del glosario: todas las notas",
      "cmd.collectThisNote": "Recopilar alias desde enlaces: esta nota",
      "cmd.collectAllNotes": "Recopilar alias desde enlaces: todas las notas",
      "cmd.createTerm": "Crear t\xE9rmino del glosario desde la selecci\xF3n",
      "cmd.rebuildIndex": "Reconstruir \xEDndice del glosario",
      "ribbon.tooltip": "Resumen del glosario",
      "statusBar.aria": "{n} t\xE9rmino(s) del glosario en esta p\xE1gina \u2014 clic para enlazarlos",
      "menu.createTermLink": "Glossary: crear t\xE9rmino y enlazar",
      "menu.createTerm": "Glossary: crear t\xE9rmino",
      "menu.unlinkThisTerm": "Glossary: desenlazar este t\xE9rmino",
      "menu.collectThisAlias": "Glossary: recopilar este alias",
      "menu.collectFromNote": "Glossary: recopilar alias desde enlaces (esta nota)",
      "menu.removeFromAlwaysExcluded": "Glossary: quitar de siempre excluidos",
      "menu.addToAlwaysExcluded": "Glossary: a\xF1adir {noun} a siempre excluidos",
      "menu.removeFromScope": "Glossary: quitar {noun} del \xE1mbito",
      "menu.includeInScope": "Glossary: incluir {noun} en el \xE1mbito",
      "menu.linkToTerm": "Enlazar con t\xE9rmino",
      "menu.linkScopeThisNote": "Enlazar {scope} \xAB{display}\xBB con t\xE9rmino: esta nota",
      "menu.linkScopeAllNotes": "Enlazar {scope} \xAB{display}\xBB con t\xE9rmino: todas las notas",
      "menu.openNote": "Abrir nota del glosario",
      "menu.openNewTab": "Abrir en pesta\xF1a nueva",
      "menu.openTitle": "Abrir\u2026",
      "menu.openNewTabTitle": "Abrir en pesta\xF1a nueva\u2026",
      "exclude.words": "palabras excluidas",
      "exclude.terms": "t\xE9rminos excluidos",
      "exclude.addPrefixed": "Glossary: a\xF1adir \xAB{value}\xBB a {noun}",
      "exclude.removePrefixed": "Glossary: quitar \xAB{value}\xBB de {noun}",
      "exclude.add": "A\xF1adir \xAB{value}\xBB a {noun}",
      "exclude.remove": "Quitar \xAB{value}\xBB de {noun}",
      "notice.indexRebuilt": "Glossary Linker: \xEDndice reconstruido",
      "notice.unlinked": "Glossary Linker: desenlazado",
      "notice.noActiveNote": "No hay nota activa",
      "notice.noSelection": "No hay selecci\xF3n",
      "notice.noMatches": "Glossary Linker: no se encontraron coincidencias",
      "notice.noGlossaryLinks": "Glossary Linker: no se encontraron enlaces del glosario",
      "notice.noteChanged": "Glossary Linker: la nota cambi\xF3 desde la vista previa, no se escribi\xF3 nada",
      "notice.scopeWritten": "Glossary Linker: {files}, {links}",
      "notice.scopeSkipped": ", {n} omitido(s) (cambiado desde la vista previa)",
      "notice.linksCreated": "Glossary Linker: {links} creado(s)",
      "notice.linksRemoved": "Glossary Linker: {links} eliminado(s)",
      "notice.linkCreatedSingle": "Glossary Linker: enlace creado",
      "notice.occurrenceNotFound": "Glossary Linker: aparici\xF3n no encontrada",
      "notice.noOccurrences": "Glossary Linker: no se encontraron apariciones",
      "notice.scanning": "Glossary Linker: analizando\u2026",
      "notice.scanningProgress": "Glossary Linker: analizando {current}/{total}\u2026",
      "notice.nothingSelected": "Glossary Linker: nada seleccionado",
      "notice.alreadyMatchesOpened": "Glossary Linker: \xAB{sel}\xBB ya coincide con \xAB{term}\xBB \u2014 abierto",
      "notice.invalidTermName": "Glossary Linker: la selecci\xF3n no es un nombre de t\xE9rmino v\xE1lido",
      "notice.termExists": "Glossary Linker: el t\xE9rmino \xAB{name}\xBB ya existe",
      "notice.couldNotCreate": "Glossary Linker: no se pudo crear la nota del t\xE9rmino",
      "notice.templateNotFound": "Glossary Linker: plantilla no encontrada: {path}",
      "notice.couldNotReadTemplate": "Glossary Linker: no se pudo leer la plantilla",
      "notice.alreadyExcluded": "Glossary Linker: \xAB{value}\xBB ya est\xE1 excluido",
      "notice.addedToExcluded": "Glossary Linker: \xAB{value}\xBB a\xF1adido a {where}",
      "notice.wasNotExcluded": "Glossary Linker: \xAB{value}\xBB no estaba excluido",
      "notice.removedFromExcluded": "Glossary Linker: \xAB{value}\xBB quitado de {where}",
      "notice.aliasesAdded": "Glossary Linker: {aliases} a\xF1adido(s)",
      "notice.noNewAliases": "Glossary Linker: no se encontraron alias nuevos",
      "notice.wordingMatchesTerm": "Glossary Linker: ese texto ya coincide con el t\xE9rmino",
      "notice.noNewAlias": "Glossary Linker: no hay alias nuevo que recopilar",
      "notice.pathAddedExcluded": "Glossary Linker: \xAB{entry}\xBB a\xF1adido a rutas siempre excluidas",
      "notice.pathRemovedExcluded": "Glossary Linker: \xAB{entry}\xBB quitado de rutas siempre excluidas",
      "notice.pathAddedScope": "Glossary Linker: \xAB{entry}\xBB a\xF1adido a rutas del \xE1mbito",
      "notice.pathRemovedScope": "Glossary Linker: \xAB{entry}\xBB quitado de rutas del \xE1mbito",
      "set.heading.collecting": "Recopilar alias",
      "set.heading.overview": "Resumen",
      "set.glossaryFolder.name": "Carpeta del glosario",
      "set.glossaryFolder.desc": "Carpeta con una nota por t\xE9rmino (nombre de archivo = t\xEDtulo del t\xE9rmino).",
      "set.termTemplate.name": "Plantilla de t\xE9rmino",
      "set.termTemplate.desc": "Nota usada como cuerpo de las nuevas notas de t\xE9rmino; los marcadores como {{title}} y {{date}} se rellenan. Vac\xEDo = nota en blanco.",
      "set.scopeMode.name": "\xC1mbito de enlazado",
      "set.scopeMode.desc": "En qu\xE9 notas se resaltan y enlazan los t\xE9rminos.",
      "set.scopeMode.folders": "Solo rutas indicadas",
      "set.scopeMode.vault": "En todas partes",
      "set.scopeFolders.name": "Rutas a incluir",
      "set.scopeFolders.desc": "Un archivo o una carpeta. Solo estas (y las notas dentro de las carpetas indicadas) est\xE1n en el \xE1mbito.",
      "set.excludeFolders.name": "Rutas siempre excluidas",
      "set.excludeFolders.desc": "Un archivo o una carpeta, nunca se resalta, enlaza ni analiza, sea cual sea el modo de arriba.",
      "set.matchMode.name": "Morfolog\xEDa",
      "set.matchMode.desc": "C\xF3mo se asocia una palabra flexionada a un t\xE9rmino.",
      "set.matchMode.stemmer": "Lematizador (recomendado)",
      "set.matchMode.endingStrip": "Quitar terminaciones",
      "set.matchMode.exact": "Coincidencia exacta",
      "set.minTermLength.name": "Longitud m\xEDnima del t\xE9rmino",
      "set.minTermLength.desc": "Ignorar t\xEDtulos y alias de t\xE9rminos m\xE1s cortos que esta cantidad de caracteres, para que las letras sueltas no coincidan en todas partes.",
      "set.languages.desc": "M\xF3dulos de morfolog\xEDa incluidos \u2014 {enabled} de {total} activados",
      "set.languages.invalidSuffix": ", {n} no v\xE1lidos",
      "set.lang.invalid": "M\xF3dulo no v\xE1lido: {error}",
      "set.linkFirstOnly.desc": "Al convertir t\xE9rminos en enlaces, enlazar solo la primera aparici\xF3n de cada t\xE9rmino en una p\xE1gina.",
      "set.excludeTerms.name": "T\xE9rminos excluidos",
      "set.excludeTerms.desc": "T\xEDtulos o alias de t\xE9rminos, uno por l\xEDnea \u2014 quita del \xEDndice toda la entrada coincidente.",
      "set.excludeWords.name": "Palabras excluidas",
      "set.excludeWords.desc": "Palabras del texto, una por l\xEDnea, que nunca generan un enlace aunque coincidan con un t\xE9rmino.",
      "set.highlightInReading.desc": "Subrayar los t\xE9rminos detectados como enlaces en los que se puede hacer clic en la vista de lectura (archivo sin cambios).",
      "set.editingHighlight.name": "Resaltar al editar",
      "set.editingHighlight.desc": "Subrayar los t\xE9rminos tambi\xE9n en el editor (Vista previa en vivo / C\xF3digo fuente).",
      "set.editingHighlight.off": "Desactivado",
      "set.editingHighlight.live": "En vivo (mientras escribes)",
      "set.skipHeadings.desc": "No resaltar ni enlazar t\xE9rminos que aparezcan dentro de encabezados Markdown.",
      "set.statusBar.desc": "Mostrar en la barra de estado cu\xE1ntos t\xE9rminos del glosario hay en la nota actual.",
      "set.statusBarIncludeLinks.name": "Contar enlaces directos",
      "set.statusBarIncludeLinks.desc": "Contar tambi\xE9n los t\xE9rminos ya enlazados directamente, no solo las menciones en texto.",
      "set.linkSuggest.desc": "Mientras escribes en una nota del \xE1mbito, ofrecer insertar un [[enlace]] a un t\xE9rmino del glosario coincidente (prefijo de un t\xEDtulo/alias, o una forma flexionada).",
      "set.suggestMinChars.name": "Caracteres m\xEDnimos",
      "set.suggestSkipAfter.desc": "No sugerir cuando la palabra sigue a uno de estos caracteres, para que otras autocompletados (etiquetas, enlaces de c\xF3digo, matem\xE1ticas) conserven su lugar. Dejar vac\xEDo para desactivar.",
      "set.aliasHarvestMode.name": "Forma del alias",
      "set.aliasHarvestMode.desc": "C\xF3mo se guarda como alias el texto de enlace recopilado.",
      "set.aliasHarvestMode.lemma": "Forma base",
      "set.aliasHarvestMode.literal": "Tal como est\xE1 escrito",
      "set.aliasHarvestMode.both": "Ambas",
      "set.harvestOnSave.name": "Recopilar al guardar",
      "set.harvestOnSave.desc": "Recopilar alias autom\xE1ticamente al guardar una nota.",
      "set.harvestOnSave.off": "Desactivado",
      "set.harvestOnSave.silent": "Silencioso (a\xF1adir autom\xE1ticamente)",
      "set.harvestOnSave.preview": "Preguntar primero",
      "set.harvestSingleWordOnly.name": "Solo alias de una palabra",
      "set.harvestSingleWordOnly.desc": "Recopilar solo textos de enlace que sean una sola palabra.",
      "set.harvestMinLength.name": "Longitud m\xEDnima del alias",
      "set.harvestMinLength.desc": "Ignorar los alias recopilados m\xE1s cortos que esta cantidad de caracteres.",
      "set.aliasCollisionWarnings.name": "Avisar de conflictos de alias",
      "set.aliasCollisionWarnings.desc": "Al recopilar un alias o crear un t\xE9rmino, marcar el texto que ya coincide con otro t\xE9rmino (para evitar que una palabra apunte a dos t\xE9rminos).",
      "set.menuTurnInto.name": "Elementos \xABEnlazar con t\xE9rmino\xBB",
      "set.menuTurnInto.desc": "Mostrar las acciones \xABEnlazar con t\xE9rmino\xBB / \xABEnlazar todas \u2026 con t\xE9rmino\xBB en el men\xFA contextual de un t\xE9rmino resaltado.",
      "set.menuCollect.name": "Elemento \xABRecopilar alias\xBB",
      "set.menuCollect.desc": "Mostrar \xABRecopilar alias desde enlaces (esta nota)\xBB en el men\xFA contextual del editor.",
      "set.menuExclude.name": "Elementos \xABExcluir palabra / t\xE9rmino\xBB",
      "set.menuExclude.desc": "Mostrar \xABA\xF1adir \u2026 a palabras / t\xE9rminos excluidos\xBB en el men\xFA contextual.",
      "set.menuOpen.name": "Elementos \xABAbrir nota del glosario\xBB",
      "set.menuOpen.desc": "Mostrar \xABAbrir nota del glosario\xBB / \xABAbrir en pesta\xF1a nueva\xBB en el men\xFA contextual de un t\xE9rmino resaltado.",
      "set.menuCreateTerm.name": "Elementos \xABCrear t\xE9rmino desde la selecci\xF3n\xBB",
      "set.menuCreateTerm.desc": "Mostrar las acciones \xABGlossary: crear t\xE9rmino\u2026\xBB en el men\xFA contextual de una selecci\xF3n de texto.",
      "set.menuUnlink.name": "Elemento \xABDesenlazar t\xE9rmino\xBB",
      "set.menuUnlink.desc": "Mostrar \xABGlossary: desenlazar este t\xE9rmino\xBB en el men\xFA contextual de un enlace del glosario existente.",
      "set.showRibbonIcon.name": "Icono de la barra lateral",
      "set.showRibbonIcon.desc": "Mostrar un bot\xF3n en la barra lateral que abre el panel de resumen del glosario. El comando \xABAbrir resumen del glosario\xBB funciona de todos modos.",
      "set.rebuild.name": "Reconstruir \xEDndice del glosario",
      "set.rebuild.desc": "Volver a analizar la carpeta del glosario ahora.",
      "set.collecting.desc": "Lee los enlaces que ya hiciste a mano, como [[T\xE9rmino|alg\xFAn texto]], y a\xF1ade ese texto a los alias del t\xE9rmino \u2014 para que el mismo texto se enlace autom\xE1ticamente la pr\xF3xima vez.",
      "set.folderNotFound": "\u26A0 Carpeta no encontrada \u2014 no se indexar\xE1 ning\xFAn t\xE9rmino.",
      "set.termsIndexed": "{terms} indexado(s).",
      "modal.materialize.title": "Enlazar t\xE9rminos del glosario \u2014 vista previa",
      "modal.materialize.summary": "Archivos: {files}, reemplazos: {replacements}",
      "modal.materialize.ambiguous": "{n} palabra(s) ambigua(s) coinciden con m\xE1s de un t\xE9rmino \u2014 elige una (se aplica a cada aparici\xF3n):",
      "modal.skipOption": "(omitir \u2014 dejar como texto)",
      "modal.leftAsText": "\u2014 dejado como texto \u2014",
      "modal.harvest.title": "Recopilar alias \u2014 vista previa",
      "modal.harvest.summary": "T\xE9rminos: {terms}, alias nuevos: {aliases}",
      "modal.harvest.alsoMatches": "Tambi\xE9n coincide con: {terms}",
      "modal.harvest.alreadyPresent": "Ya presentes (omitidos): {items}",
      "modal.unlink.title": "Desenlazar t\xE9rminos del glosario \u2014 vista previa",
      "modal.unlink.summary": "Archivos: {files}, enlaces a eliminar: {links}",
      "modal.choose.body": "Esta palabra coincide con m\xE1s de un t\xE9rmino \u2014 elige uno:",
      "btn.write": "Escribir",
      "label.selection": "selecci\xF3n",
      "view.title": "Glosario",
      "overview.rescan": "Volver a analizar",
      "overview.wholeVault": "todo el almac\xE9n",
      "overview.wholeVaultAria": "Analizar todas las notas, no solo el \xE1mbito del enlazador",
      "overview.terms": "T\xE9rminos",
      "overview.candidates": "Candidatos",
      "overview.sort": "Ordenar",
      "overview.sortMostUsed": "M\xE1s usados",
      "overview.sortName": "Nombre",
      "overview.countLinks": "contar enlaces",
      "overview.countLinksAria": "Contar tambi\xE9n los enlaces [[T\xE9rmino]] existentes, no solo las menciones en texto",
      "overview.noTerms": "No hay t\xE9rminos indexados.",
      "overview.openAria": "Abrir \u2014 clic central para una pesta\xF1a nueva",
      "overview.unused": "sin usar \u26A0",
      "overview.linkAll": "enlazar todo",
      "overview.sortNotes": "Notas",
      "overview.sortMentions": "Menciones",
      "overview.minNotes": "Notas m\xEDn.",
      "overview.noCandidates": "No hay candidatos.",
      "overview.addTerm": "+ t\xE9rmino",
      "suggest.inflection": "flexi\xF3n",
      "suggest.alias": "alias: {form}",
      "highlight.matches": "Coincide con: {terms}",
      "plural.term": { one: "{n} t\xE9rmino", other: "{n} t\xE9rminos" },
      "plural.use": { one: "{n} uso", other: "{n} usos" },
      "plural.note": { one: "{n} nota", other: "{n} notas" },
      "plural.link": { one: "{n} enlace", other: "{n} enlaces" },
      "plural.file": { one: "{n} archivo", other: "{n} archivos" },
      "plural.alias": { one: "{n} alias", other: "{n} alias" }
    };
  }
});

// src/locales/fr.js
var require_fr2 = __commonJS({
  "src/locales/fr.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      "cmd.openOverview": "Ouvrir l\u2019aper\xE7u du glossaire",
      "cmd.linkThisNote": "Lier les termes du glossaire : cette note",
      "cmd.linkSelection": "Lier les termes du glossaire : s\xE9lection",
      "cmd.linkAllNotes": "Lier les termes du glossaire : toutes les notes",
      "cmd.unlinkThisNote": "D\xE9lier les termes du glossaire : cette note",
      "cmd.unlinkSelection": "D\xE9lier les termes du glossaire : s\xE9lection",
      "cmd.unlinkAllNotes": "D\xE9lier les termes du glossaire : toutes les notes",
      "cmd.collectThisNote": "Collecter les alias depuis les liens : cette note",
      "cmd.collectAllNotes": "Collecter les alias depuis les liens : toutes les notes",
      "cmd.createTerm": "Cr\xE9er un terme du glossaire \xE0 partir de la s\xE9lection",
      "cmd.rebuildIndex": "Reconstruire l\u2019index du glossaire",
      "ribbon.tooltip": "Aper\xE7u du glossaire",
      "statusBar.aria": "{n} terme(s) du glossaire sur cette page \u2014 cliquez pour les lier",
      "menu.createTermLink": "Glossary : cr\xE9er le terme et lier",
      "menu.createTerm": "Glossary : cr\xE9er le terme",
      "menu.unlinkThisTerm": "Glossary : d\xE9lier ce terme",
      "menu.collectThisAlias": "Glossary : collecter cet alias",
      "menu.collectFromNote": "Glossary : collecter les alias depuis les liens (cette note)",
      "menu.removeFromAlwaysExcluded": "Glossary : retirer des toujours exclus",
      "menu.addToAlwaysExcluded": "Glossary : ajouter {noun} aux toujours exclus",
      "menu.removeFromScope": "Glossary : retirer {noun} de la port\xE9e",
      "menu.includeInScope": "Glossary : inclure {noun} dans la port\xE9e",
      "menu.linkToTerm": "Lier au terme",
      "menu.linkScopeThisNote": "Lier {scope} \xAB {display} \xBB au terme : cette note",
      "menu.linkScopeAllNotes": "Lier {scope} \xAB {display} \xBB au terme : toutes les notes",
      "menu.openNote": "Ouvrir la note du glossaire",
      "menu.openNewTab": "Ouvrir dans un nouvel onglet",
      "menu.openTitle": "Ouvrir\u2026",
      "menu.openNewTabTitle": "Ouvrir dans un nouvel onglet\u2026",
      "exclude.words": "mots exclus",
      "exclude.terms": "termes exclus",
      "exclude.addPrefixed": "Glossary : ajouter \xAB {value} \xBB \xE0 {noun}",
      "exclude.removePrefixed": "Glossary : retirer \xAB {value} \xBB de {noun}",
      "exclude.add": "Ajouter \xAB {value} \xBB \xE0 {noun}",
      "exclude.remove": "Retirer \xAB {value} \xBB de {noun}",
      "notice.indexRebuilt": "Glossary Linker : index reconstruit",
      "notice.unlinked": "Glossary Linker : d\xE9li\xE9",
      "notice.noActiveNote": "Aucune note active",
      "notice.noSelection": "Aucune s\xE9lection",
      "notice.noMatches": "Glossary Linker : aucune correspondance trouv\xE9e",
      "notice.noGlossaryLinks": "Glossary Linker : aucun lien de glossaire trouv\xE9",
      "notice.noteChanged": "Glossary Linker : la note a chang\xE9 depuis l\u2019aper\xE7u, rien n\u2019a \xE9t\xE9 \xE9crit",
      "notice.scopeWritten": "Glossary Linker : {files}, {links}",
      "notice.scopeSkipped": ", {n} ignor\xE9(s) (modifi\xE9 depuis l\u2019aper\xE7u)",
      "notice.linksCreated": "Glossary Linker : {links} cr\xE9\xE9(s)",
      "notice.linksRemoved": "Glossary Linker : {links} supprim\xE9(s)",
      "notice.linkCreatedSingle": "Glossary Linker : lien cr\xE9\xE9",
      "notice.occurrenceNotFound": "Glossary Linker : occurrence introuvable",
      "notice.noOccurrences": "Glossary Linker : aucune occurrence trouv\xE9e",
      "notice.scanning": "Glossary Linker : analyse\u2026",
      "notice.scanningProgress": "Glossary Linker : analyse {current}/{total}\u2026",
      "notice.nothingSelected": "Glossary Linker : rien de s\xE9lectionn\xE9",
      "notice.alreadyMatchesOpened": "Glossary Linker : \xAB {sel} \xBB correspond d\xE9j\xE0 \xE0 \xAB {term} \xBB \u2014 ouvert",
      "notice.invalidTermName": "Glossary Linker : la s\xE9lection n\u2019est pas un nom de terme valide",
      "notice.termExists": "Glossary Linker : le terme \xAB {name} \xBB existe d\xE9j\xE0",
      "notice.couldNotCreate": "Glossary Linker : impossible de cr\xE9er la note du terme",
      "notice.templateNotFound": "Glossary Linker : mod\xE8le introuvable : {path}",
      "notice.couldNotReadTemplate": "Glossary Linker : impossible de lire le mod\xE8le",
      "notice.alreadyExcluded": "Glossary Linker : \xAB {value} \xBB est d\xE9j\xE0 exclu",
      "notice.addedToExcluded": "Glossary Linker : \xAB {value} \xBB ajout\xE9 \xE0 {where}",
      "notice.wasNotExcluded": "Glossary Linker : \xAB {value} \xBB n\u2019\xE9tait pas exclu",
      "notice.removedFromExcluded": "Glossary Linker : \xAB {value} \xBB retir\xE9 de {where}",
      "notice.aliasesAdded": "Glossary Linker : {aliases} ajout\xE9(s)",
      "notice.noNewAliases": "Glossary Linker : aucun nouvel alias trouv\xE9",
      "notice.wordingMatchesTerm": "Glossary Linker : ce libell\xE9 correspond d\xE9j\xE0 au terme",
      "notice.noNewAlias": "Glossary Linker : aucun nouvel alias \xE0 collecter",
      "notice.pathAddedExcluded": "Glossary Linker : \xAB {entry} \xBB ajout\xE9 aux chemins toujours exclus",
      "notice.pathRemovedExcluded": "Glossary Linker : \xAB {entry} \xBB retir\xE9 des chemins toujours exclus",
      "notice.pathAddedScope": "Glossary Linker : \xAB {entry} \xBB ajout\xE9 aux chemins de la port\xE9e",
      "notice.pathRemovedScope": "Glossary Linker : \xAB {entry} \xBB retir\xE9 des chemins de la port\xE9e",
      "set.heading.collecting": "Collecte des alias",
      "set.heading.overview": "Aper\xE7u",
      "set.glossaryFolder.name": "Dossier du glossaire",
      "set.glossaryFolder.desc": "Dossier avec une note par terme (nom de fichier = titre du terme).",
      "set.termTemplate.name": "Mod\xE8le de terme",
      "set.termTemplate.desc": "Note utilis\xE9e comme corps des nouvelles notes de terme ; les balises comme {{title}} et {{date}} sont remplies. Vide = note vierge.",
      "set.scopeMode.name": "Port\xE9e du liage",
      "set.scopeMode.desc": "Dans quelles notes les termes sont surlign\xE9s et li\xE9s.",
      "set.scopeMode.folders": "Chemins list\xE9s seulement",
      "set.scopeMode.vault": "Partout",
      "set.scopeFolders.name": "Chemins \xE0 inclure",
      "set.scopeFolders.desc": "Un fichier ou un dossier. Seuls ceux-ci (et les notes dans les dossiers list\xE9s) sont dans la port\xE9e.",
      "set.excludeFolders.name": "Chemins toujours exclus",
      "set.excludeFolders.desc": "Un fichier ou un dossier, jamais surlign\xE9, li\xE9 ni analys\xE9, quel que soit le mode ci-dessus.",
      "set.matchMode.name": "Morphologie",
      "set.matchMode.desc": "Comment un mot fl\xE9chi est associ\xE9 \xE0 un terme.",
      "set.matchMode.stemmer": "Racinisation (recommand\xE9)",
      "set.matchMode.endingStrip": "Suppression des terminaisons",
      "set.matchMode.exact": "Correspondance exacte",
      "set.minTermLength.name": "Longueur minimale du terme",
      "set.minTermLength.desc": "Ignorer les titres et alias de termes plus courts que ce nombre de caract\xE8res, pour que les lettres isol\xE9es ne correspondent pas partout.",
      "set.languages.desc": "Modules de morphologie inclus \u2014 {enabled} sur {total} activ\xE9s",
      "set.languages.invalidSuffix": ", {n} non valides",
      "set.lang.invalid": "Module non valide : {error}",
      "set.linkFirstOnly.desc": "Lors de la conversion des termes en liens, ne lier que la premi\xE8re occurrence de chaque terme sur une page.",
      "set.excludeTerms.name": "Termes exclus",
      "set.excludeTerms.desc": "Titres ou alias de termes, un par ligne \u2014 retire toute l\u2019entr\xE9e correspondante de l\u2019index.",
      "set.excludeWords.name": "Mots exclus",
      "set.excludeWords.desc": "Mots du texte, un par ligne, qui ne d\xE9clenchent jamais de lien m\xEAme s\u2019ils correspondent \xE0 un terme.",
      "set.highlightInReading.desc": "Souligner les termes d\xE9tect\xE9s comme des liens cliquables en mode lecture (fichier inchang\xE9).",
      "set.editingHighlight.name": "Surligner pendant l\u2019\xE9dition",
      "set.editingHighlight.desc": "Souligner les termes aussi dans l\u2019\xE9diteur (Aper\xE7u en direct / Source).",
      "set.editingHighlight.off": "D\xE9sactiv\xE9",
      "set.editingHighlight.live": "En direct (pendant la saisie)",
      "set.skipHeadings.desc": "Ne pas surligner ni lier les termes qui apparaissent dans les titres Markdown.",
      "set.statusBar.desc": "Afficher dans la barre d\u2019\xE9tat combien de termes du glossaire sont dans la note actuelle.",
      "set.statusBarIncludeLinks.name": "Compter les liens directs",
      "set.statusBarIncludeLinks.desc": "Compter aussi les termes d\xE9j\xE0 li\xE9s directement, pas seulement les mentions en texte.",
      "set.linkSuggest.desc": "Pendant la saisie dans une note de la port\xE9e, proposer d\u2019ins\xE9rer un [[lien]] vers un terme du glossaire correspondant (pr\xE9fixe d\u2019un titre/alias, ou une forme fl\xE9chie).",
      "set.suggestMinChars.name": "Caract\xE8res minimum",
      "set.suggestSkipAfter.desc": "Ne pas sugg\xE9rer quand le mot suit l'un de ces caract\xE8res, afin que les autres autocompl\xE9tions (\xE9tiquettes, liens de code, math) gardent leur place. Laisser vide pour d\xE9sactiver.",
      "set.aliasHarvestMode.name": "Forme de l\u2019alias",
      "set.aliasHarvestMode.desc": "Comment le texte de lien collect\xE9 est stock\xE9 comme alias.",
      "set.aliasHarvestMode.lemma": "Forme de base",
      "set.aliasHarvestMode.literal": "Tel quel",
      "set.aliasHarvestMode.both": "Les deux",
      "set.harvestOnSave.name": "Collecter \xE0 l\u2019enregistrement",
      "set.harvestOnSave.desc": "Collecter les alias automatiquement quand une note est enregistr\xE9e.",
      "set.harvestOnSave.off": "D\xE9sactiv\xE9",
      "set.harvestOnSave.silent": "Silencieux (ajouter automatiquement)",
      "set.harvestOnSave.preview": "Demander d\u2019abord",
      "set.harvestSingleWordOnly.name": "Alias d\u2019un seul mot uniquement",
      "set.harvestSingleWordOnly.desc": "Collecter seulement les textes de lien compos\xE9s d\u2019un seul mot.",
      "set.harvestMinLength.name": "Longueur minimale de l\u2019alias",
      "set.harvestMinLength.desc": "Ignorer les alias collect\xE9s plus courts que ce nombre de caract\xE8res.",
      "set.aliasCollisionWarnings.name": "Avertir des conflits d\u2019alias",
      "set.aliasCollisionWarnings.desc": "Lors de la collecte d\u2019un alias ou de la cr\xE9ation d\u2019un terme, signaler un libell\xE9 qui correspond d\xE9j\xE0 \xE0 un autre terme (pour \xE9viter qu\u2019un mot pointe vers deux termes).",
      "set.menuTurnInto.name": "\xC9l\xE9ments \xAB Lier au terme \xBB",
      "set.menuTurnInto.desc": "Afficher les actions \xAB Lier au terme \xBB / \xAB Lier tout \u2026 au terme \xBB dans le menu contextuel d\u2019un terme surlign\xE9.",
      "set.menuCollect.name": "\xC9l\xE9ment \xAB Collecter les alias \xBB",
      "set.menuCollect.desc": "Afficher \xAB Collecter les alias depuis les liens (cette note) \xBB dans le menu contextuel de l\u2019\xE9diteur.",
      "set.menuExclude.name": "\xC9l\xE9ments \xAB Exclure le mot / terme \xBB",
      "set.menuExclude.desc": "Afficher \xAB Ajouter \u2026 aux mots / termes exclus \xBB dans le menu contextuel.",
      "set.menuOpen.name": "\xC9l\xE9ments \xAB Ouvrir la note du glossaire \xBB",
      "set.menuOpen.desc": "Afficher \xAB Ouvrir la note du glossaire \xBB / \xAB Ouvrir dans un nouvel onglet \xBB dans le menu contextuel d\u2019un terme surlign\xE9.",
      "set.menuCreateTerm.name": "\xC9l\xE9ments \xAB Cr\xE9er un terme depuis la s\xE9lection \xBB",
      "set.menuCreateTerm.desc": "Afficher les actions \xAB Glossary : cr\xE9er le terme\u2026 \xBB dans le menu contextuel d\u2019une s\xE9lection de texte.",
      "set.menuUnlink.name": "\xC9l\xE9ment \xAB D\xE9lier le terme \xBB",
      "set.menuUnlink.desc": "Afficher \xAB Glossary : d\xE9lier ce terme \xBB dans le menu contextuel d\u2019un lien de glossaire existant.",
      "set.showRibbonIcon.name": "Ic\xF4ne de la barre lat\xE9rale",
      "set.showRibbonIcon.desc": "Afficher un bouton dans la barre lat\xE9rale qui ouvre le panneau d\u2019aper\xE7u du glossaire. La commande \xAB Ouvrir l\u2019aper\xE7u du glossaire \xBB fonctionne de toute fa\xE7on.",
      "set.rebuild.name": "Reconstruire l\u2019index du glossaire",
      "set.rebuild.desc": "R\xE9analyser le dossier du glossaire maintenant.",
      "set.collecting.desc": "Lit les liens que vous avez faits \xE0 la main, comme [[Terme|un libell\xE9]], et ajoute ce libell\xE9 aux alias du terme \u2014 pour que le m\xEAme libell\xE9 soit li\xE9 automatiquement la prochaine fois.",
      "set.folderNotFound": "\u26A0 Dossier introuvable \u2014 aucun terme ne sera index\xE9.",
      "set.termsIndexed": "{terms} index\xE9(s).",
      "modal.materialize.title": "Lier les termes du glossaire \u2014 aper\xE7u",
      "modal.materialize.summary": "Fichiers : {files}, remplacements : {replacements}",
      "modal.materialize.ambiguous": "{n} mot(s) ambigu(s) correspondent \xE0 plus d\u2019un terme \u2014 choisissez-en un (s\u2019applique \xE0 chaque occurrence) :",
      "modal.skipOption": "(ignorer \u2014 laisser en texte)",
      "modal.leftAsText": "\u2014 laiss\xE9 en texte \u2014",
      "modal.harvest.title": "Collecter les alias \u2014 aper\xE7u",
      "modal.harvest.summary": "Termes : {terms}, nouveaux alias : {aliases}",
      "modal.harvest.alsoMatches": "Correspond aussi \xE0 : {terms}",
      "modal.harvest.alreadyPresent": "D\xE9j\xE0 pr\xE9sents (ignor\xE9s) : {items}",
      "modal.unlink.title": "D\xE9lier les termes du glossaire \u2014 aper\xE7u",
      "modal.unlink.summary": "Fichiers : {files}, liens \xE0 supprimer : {links}",
      "modal.choose.body": "Ce mot correspond \xE0 plus d\u2019un terme \u2014 choisissez-en un :",
      "btn.write": "\xC9crire",
      "label.selection": "s\xE9lection",
      "view.title": "Glossaire",
      "overview.rescan": "R\xE9analyser",
      "overview.wholeVault": "tout le coffre",
      "overview.wholeVaultAria": "Analyser toutes les notes, pas seulement la port\xE9e du lieur",
      "overview.terms": "Termes",
      "overview.candidates": "Candidats",
      "overview.sort": "Trier",
      "overview.sortMostUsed": "Les plus utilis\xE9s",
      "overview.sortName": "Nom",
      "overview.countLinks": "compter les liens",
      "overview.countLinksAria": "Compter aussi les liens [[Terme]] existants, pas seulement les mentions en texte",
      "overview.noTerms": "Aucun terme index\xE9.",
      "overview.openAria": "Ouvrir \u2014 clic du milieu pour un nouvel onglet",
      "overview.unused": "inutilis\xE9 \u26A0",
      "overview.linkAll": "tout lier",
      "overview.sortNotes": "Notes",
      "overview.sortMentions": "Mentions",
      "overview.minNotes": "Notes min.",
      "overview.noCandidates": "Aucun candidat.",
      "overview.addTerm": "+ terme",
      "suggest.inflection": "flexion",
      "suggest.alias": "alias : {form}",
      "highlight.matches": "Correspond \xE0 : {terms}",
      "plural.term": { one: "{n} terme", other: "{n} termes" },
      "plural.use": { one: "{n} utilisation", other: "{n} utilisations" },
      "plural.note": { one: "{n} note", other: "{n} notes" },
      "plural.link": { one: "{n} lien", other: "{n} liens" },
      "plural.file": { one: "{n} fichier", other: "{n} fichiers" },
      "plural.alias": { one: "{n} alias", other: "{n} alias" }
    };
  }
});

// src/locales/uk.js
var require_uk2 = __commonJS({
  "src/locales/uk.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      "cmd.openOverview": "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043E\u0433\u043B\u044F\u0434 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F",
      "cmd.linkThisNote": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F: \u0446\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430",
      "cmd.linkSelection": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F: \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043D\u044F",
      "cmd.linkAllNotes": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F: \u0443\u0441\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
      "cmd.unlinkThisNote": "\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0438: \u0446\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430",
      "cmd.unlinkSelection": "\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0438: \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043D\u044F",
      "cmd.unlinkAllNotes": "\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0438: \u0443\u0441\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
      "cmd.collectThisNote": "\u0417\u0456\u0431\u0440\u0430\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u0437 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C: \u0446\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430",
      "cmd.collectAllNotes": "\u0417\u0456\u0431\u0440\u0430\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u0437 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C: \u0443\u0441\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
      "cmd.createTerm": "\u0421\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F \u0437 \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043D\u044F",
      "cmd.rebuildIndex": "\u041F\u0435\u0440\u0435\u0431\u0443\u0434\u0443\u0432\u0430\u0442\u0438 \u0456\u043D\u0434\u0435\u043A\u0441 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F",
      "ribbon.tooltip": "\u041E\u0433\u043B\u044F\u0434 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F",
      "statusBar.aria": "\u0422\u0435\u0440\u043C\u0456\u043D\u0456\u0432 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F \u043D\u0430 \u0446\u0456\u0439 \u0441\u0442\u043E\u0440\u0456\u043D\u0446\u0456: {n} \u2014 \u043D\u0430\u0442\u0438\u0441\u043D\u0456\u0442\u044C, \u0449\u043E\u0431 \u0437\u0432\u2019\u044F\u0437\u0430\u0442\u0438",
      "menu.createTermLink": "Glossary: \u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D \u0456 \u0437\u0432\u2019\u044F\u0437\u0430\u0442\u0438",
      "menu.createTerm": "Glossary: \u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D",
      "menu.unlinkThisTerm": "Glossary: \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0446\u0435\u0439 \u0442\u0435\u0440\u043C\u0456\u043D",
      "menu.collectThisAlias": "Glossary: \u0437\u0456\u0431\u0440\u0430\u0442\u0438 \u0446\u0435\u0439 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C",
      "menu.collectFromNote": "Glossary: \u0437\u0456\u0431\u0440\u0430\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u0437 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C (\u0446\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430)",
      "menu.removeFromAlwaysExcluded": "Glossary: \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u0437 \u0437\u0430\u0432\u0436\u0434\u0438 \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0445",
      "menu.addToAlwaysExcluded": "Glossary: \u0434\u043E\u0434\u0430\u0442\u0438 {noun} \u0434\u043E \u0437\u0430\u0432\u0436\u0434\u0438 \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0445",
      "menu.removeFromScope": "Glossary: \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 {noun} \u0437 \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043D\u043D\u044F",
      "menu.includeInScope": "Glossary: \u0432\u043A\u043B\u044E\u0447\u0438\u0442\u0438 {noun} \u0434\u043E \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043D\u043D\u044F",
      "menu.linkToTerm": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C",
      "menu.linkScopeThisNote": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 {scope} \xAB{display}\xBB \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C: \u0446\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430",
      "menu.linkScopeAllNotes": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 {scope} \xAB{display}\xBB \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C: \u0443\u0441\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
      "menu.openNote": "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F",
      "menu.openNewTab": "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0432 \u043D\u043E\u0432\u0456\u0439 \u0432\u043A\u043B\u0430\u0434\u0446\u0456",
      "menu.openTitle": "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438\u2026",
      "menu.openNewTabTitle": "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0432 \u043D\u043E\u0432\u0456\u0439 \u0432\u043A\u043B\u0430\u0434\u0446\u0456\u2026",
      "exclude.words": "\u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0456 \u0441\u043B\u043E\u0432\u0430",
      "exclude.terms": "\u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0456 \u0442\u0435\u0440\u043C\u0456\u043D\u0438",
      "exclude.addPrefixed": "Glossary: \u0434\u043E\u0434\u0430\u0442\u0438 \xAB{value}\xBB \u0434\u043E \u0441\u043F\u0438\u0441\u043A\u0443 ({noun})",
      "exclude.removePrefixed": "Glossary: \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \xAB{value}\xBB \u0437\u0456 \u0441\u043F\u0438\u0441\u043A\u0443 ({noun})",
      "exclude.add": "\u0414\u043E\u0434\u0430\u0442\u0438 \xAB{value}\xBB \u0434\u043E \u0441\u043F\u0438\u0441\u043A\u0443 ({noun})",
      "exclude.remove": "\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \xAB{value}\xBB \u0437\u0456 \u0441\u043F\u0438\u0441\u043A\u0443 ({noun})",
      "notice.indexRebuilt": "Glossary Linker: \u0456\u043D\u0434\u0435\u043A\u0441 \u043F\u0435\u0440\u0435\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u043E",
      "notice.unlinked": "Glossary Linker: \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043F\u0440\u0438\u0431\u0440\u0430\u043D\u043E",
      "notice.noActiveNote": "\u041D\u0435\u043C\u0430\u0454 \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0457 \u043D\u043E\u0442\u0430\u0442\u043A\u0438",
      "notice.noSelection": "\u041D\u0435\u043C\u0430\u0454 \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043D\u044F",
      "notice.noMatches": "Glossary Linker: \u0437\u0431\u0456\u0433\u0456\u0432 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.noGlossaryLinks": "Glossary Linker: \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C \u043D\u0430 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u0439 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.noteChanged": "Glossary Linker: \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0437\u043C\u0456\u043D\u0435\u043D\u043E \u043F\u0456\u0441\u043B\u044F \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434\u0443, \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0437\u0430\u043F\u0438\u0441\u0430\u043D\u043E",
      "notice.scopeWritten": "Glossary Linker: {files}, {links}",
      "notice.scopeSkipped": ", \u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E: {n} (\u0437\u043C\u0456\u043D\u0435\u043D\u043E \u043F\u0456\u0441\u043B\u044F \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u044C\u043E\u0433\u043E \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434\u0443)",
      "notice.linksCreated": "Glossary Linker: \u0441\u0442\u0432\u043E\u0440\u0435\u043D\u043E \u2014 {links}",
      "notice.linksRemoved": "Glossary Linker: \u043F\u0440\u0438\u0431\u0440\u0430\u043D\u043E \u2014 {links}",
      "notice.linkCreatedSingle": "Glossary Linker: \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u0441\u0442\u0432\u043E\u0440\u0435\u043D\u043E",
      "notice.occurrenceNotFound": "Glossary Linker: \u0432\u0445\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.noOccurrences": "Glossary Linker: \u0432\u0445\u043E\u0434\u0436\u0435\u043D\u044C \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.scanning": "Glossary Linker: \u0441\u043A\u0430\u043D\u0443\u0432\u0430\u043D\u043D\u044F\u2026",
      "notice.scanningProgress": "Glossary Linker: \u0441\u043A\u0430\u043D\u0443\u0432\u0430\u043D\u043D\u044F {current}/{total}\u2026",
      "notice.nothingSelected": "Glossary Linker: \u043D\u0456\u0447\u043E\u0433\u043E \u043D\u0435 \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043E",
      "notice.alreadyMatchesOpened": "Glossary Linker: \xAB{sel}\xBB \u0443\u0436\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \xAB{term}\xBB \u2014 \u0432\u0456\u0434\u043A\u0440\u0438\u0442\u043E",
      "notice.invalidTermName": "Glossary Linker: \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043D\u044F \u043D\u0435 \u0454 \u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u043E\u044E \u043D\u0430\u0437\u0432\u043E\u044E \u0442\u0435\u0440\u043C\u0456\u043D\u0430",
      "notice.termExists": "Glossary Linker: \u0442\u0435\u0440\u043C\u0456\u043D \xAB{name}\xBB \u0432\u0436\u0435 \u0456\u0441\u043D\u0443\u0454",
      "notice.couldNotCreate": "Glossary Linker: \u043D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0442\u0435\u0440\u043C\u0456\u043D\u0430",
      "notice.templateNotFound": "Glossary Linker: \u0448\u0430\u0431\u043B\u043E\u043D \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E: {path}",
      "notice.couldNotReadTemplate": "Glossary Linker: \u043D\u0435 \u0432\u0434\u0430\u043B\u043E\u0441\u044F \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u0438 \u0448\u0430\u0431\u043B\u043E\u043D",
      "notice.alreadyExcluded": "Glossary Linker: \xAB{value}\xBB \u0432\u0436\u0435 \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u043E",
      "notice.addedToExcluded": "Glossary Linker: \xAB{value}\xBB \u0434\u043E\u0434\u0430\u043D\u043E \u0434\u043E \u0441\u043F\u0438\u0441\u043A\u0443 ({where})",
      "notice.wasNotExcluded": "Glossary Linker: \xAB{value}\xBB \u043D\u0435 \u0431\u0443\u043B\u043E \u0443 \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F\u0445",
      "notice.removedFromExcluded": "Glossary Linker: \xAB{value}\xBB \u043F\u0440\u0438\u0431\u0440\u0430\u043D\u043E \u0437\u0456 \u0441\u043F\u0438\u0441\u043A\u0443 ({where})",
      "notice.aliasesAdded": "Glossary Linker: \u0434\u043E\u0434\u0430\u043D\u043E \u2014 {aliases}",
      "notice.noNewAliases": "Glossary Linker: \u043D\u043E\u0432\u0438\u0445 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0456\u0432 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E",
      "notice.wordingMatchesTerm": "Glossary Linker: \u0446\u0435 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0432\u0436\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0442\u0435\u0440\u043C\u0456\u043D\u0443",
      "notice.noNewAlias": "Glossary Linker: \u043D\u0435\u043C\u0430\u0454 \u043D\u043E\u0432\u043E\u0433\u043E \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0430 \u0434\u043B\u044F \u0437\u0431\u043E\u0440\u0443",
      "notice.pathAddedExcluded": "Glossary Linker: \xAB{entry}\xBB \u0434\u043E\u0434\u0430\u043D\u043E \u0434\u043E \u0437\u0430\u0432\u0436\u0434\u0438 \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0445 \u0448\u043B\u044F\u0445\u0456\u0432",
      "notice.pathRemovedExcluded": "Glossary Linker: \xAB{entry}\xBB \u043F\u0440\u0438\u0431\u0440\u0430\u043D\u043E \u0456\u0437 \u0437\u0430\u0432\u0436\u0434\u0438 \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0445 \u0448\u043B\u044F\u0445\u0456\u0432",
      "notice.pathAddedScope": "Glossary Linker: \xAB{entry}\xBB \u0434\u043E\u0434\u0430\u043D\u043E \u0434\u043E \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043D\u043D\u044F",
      "notice.pathRemovedScope": "Glossary Linker: \xAB{entry}\xBB \u043F\u0440\u0438\u0431\u0440\u0430\u043D\u043E \u0437 \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043D\u043D\u044F",
      "set.heading.collecting": "\u0417\u0431\u0456\u0440 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0456\u0432",
      "set.heading.overview": "\u041E\u0433\u043B\u044F\u0434",
      "set.glossaryFolder.name": "\u0422\u0435\u043A\u0430 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F",
      "set.glossaryFolder.desc": "\u0422\u0435\u043A\u0430 \u0437 \u043E\u0434\u043D\u0456\u0454\u044E \u043D\u043E\u0442\u0430\u0442\u043A\u043E\u044E \u043D\u0430 \u0442\u0435\u0440\u043C\u0456\u043D (\u0456\u043C\u2019\u044F \u0444\u0430\u0439\u043B\u0443 = \u043D\u0430\u0437\u0432\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0430).",
      "set.termTemplate.name": "\u0428\u0430\u0431\u043B\u043E\u043D \u0442\u0435\u0440\u043C\u0456\u043D\u0430",
      "set.termTemplate.desc": "\u041D\u043E\u0442\u0430\u0442\u043A\u0430, \u0449\u043E \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u0442\u0456\u043B\u043E \u043D\u043E\u0432\u0438\u0445 \u043D\u043E\u0442\u0430\u0442\u043E\u043A \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432; \u0437\u0430\u043F\u043E\u0432\u043D\u044E\u0432\u0430\u0447\u0456 \u043D\u0430 \u043A\u0448\u0442\u0430\u043B\u0442 {{title}} \u0456 {{date}} \u043F\u0456\u0434\u0441\u0442\u0430\u0432\u043B\u044F\u044E\u0442\u044C\u0441\u044F. \u041F\u043E\u0440\u043E\u0436\u043D\u044C\u043E = \u043F\u043E\u0440\u043E\u0436\u043D\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430.",
      "set.scopeMode.name": "\u041E\u0431\u043B\u0430\u0441\u0442\u044C \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043D\u043D\u044F",
      "set.scopeMode.desc": "\u0423 \u044F\u043A\u0438\u0445 \u043D\u043E\u0442\u0430\u0442\u043A\u0430\u0445 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u043F\u0456\u0434\u0441\u0432\u0456\u0447\u0443\u044E\u0442\u044C\u0441\u044F \u0442\u0430 \u0437\u0432\u2019\u044F\u0437\u0443\u044E\u0442\u044C\u0441\u044F.",
      "set.scopeMode.folders": "\u041B\u0438\u0448\u0435 \u0432\u043A\u0430\u0437\u0430\u043D\u0456 \u0448\u043B\u044F\u0445\u0438",
      "set.scopeMode.vault": "\u0423\u0441\u044E\u0434\u0438",
      "set.scopeFolders.name": "\u0428\u043B\u044F\u0445\u0438 \u0434\u043B\u044F \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043D\u044F",
      "set.scopeFolders.desc": "\u0424\u0430\u0439\u043B \u0430\u0431\u043E \u0442\u0435\u043A\u0430. \u0414\u043E \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043D\u043D\u044F \u0432\u0445\u043E\u0434\u044F\u0442\u044C \u043B\u0438\u0448\u0435 \u0432\u043E\u043D\u0438 (\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438 \u0432\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0456 \u0432\u043A\u0430\u0437\u0430\u043D\u0438\u0445 \u0442\u0435\u043A).",
      "set.excludeFolders.name": "\u0417\u0430\u0432\u0436\u0434\u0438 \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0456 \u0448\u043B\u044F\u0445\u0438",
      "set.excludeFolders.desc": "\u0424\u0430\u0439\u043B \u0430\u0431\u043E \u0442\u0435\u043A\u0430; \u043D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u043F\u0456\u0434\u0441\u0432\u0456\u0447\u0443\u044E\u0442\u044C\u0441\u044F, \u043D\u0435 \u0437\u0432\u2019\u044F\u0437\u0443\u044E\u0442\u044C\u0441\u044F \u0439 \u043D\u0435 \u0441\u043A\u0430\u043D\u0443\u044E\u0442\u044C\u0441\u044F, \u043D\u0435\u0437\u0430\u043B\u0435\u0436\u043D\u043E \u0432\u0456\u0434 \u0440\u0435\u0436\u0438\u043C\u0443 \u0432\u0438\u0449\u0435.",
      "set.matchMode.name": "\u041C\u043E\u0440\u0444\u043E\u043B\u043E\u0433\u0456\u044F",
      "set.matchMode.desc": "\u042F\u043A \u0441\u043B\u043E\u0432\u043E\u0444\u043E\u0440\u043C\u0430 \u0437\u0456\u0441\u0442\u0430\u0432\u043B\u044F\u0454\u0442\u044C\u0441\u044F \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C.",
      "set.matchMode.stemmer": "\u0421\u0442\u0435\u043C\u0435\u0440 (\u0440\u0435\u043A\u043E\u043C\u0435\u043D\u0434\u043E\u0432\u0430\u043D\u043E)",
      "set.matchMode.endingStrip": "\u0412\u0456\u0434\u0441\u0456\u043A\u0430\u043D\u043D\u044F \u0437\u0430\u043A\u0456\u043D\u0447\u0435\u043D\u044C",
      "set.matchMode.exact": "\u0422\u043E\u0447\u043D\u0438\u0439 \u0437\u0431\u0456\u0433",
      "set.minTermLength.name": "\u041C\u0456\u043D\u0456\u043C\u0430\u043B\u044C\u043D\u0430 \u0434\u043E\u0432\u0436\u0438\u043D\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0430",
      "set.minTermLength.desc": "\u0406\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u0442\u0438 \u043D\u0430\u0437\u0432\u0438 \u0442\u0430 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u043A\u043E\u0440\u043E\u0442\u0448\u0456 \u0437\u0430 \u0432\u043A\u0430\u0437\u0430\u043D\u0443 \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432, \u0449\u043E\u0431 \u043E\u043A\u0440\u0435\u043C\u0456 \u043B\u0456\u0442\u0435\u0440\u0438 \u043D\u0435 \u0437\u0431\u0456\u0433\u0430\u043B\u0438\u0441\u044F \u0432\u0441\u044E\u0434\u0438.",
      "set.languages.desc": "\u0412\u0431\u0443\u0434\u043E\u0432\u0430\u043D\u0456 \u043C\u043E\u0434\u0443\u043B\u0456 \u043C\u043E\u0440\u0444\u043E\u043B\u043E\u0433\u0456\u0457 \u2014 \u0443\u0432\u0456\u043C\u043A\u043D\u0435\u043D\u043E {enabled} \u0437 {total}",
      "set.languages.invalidSuffix": ", \u0437 \u043F\u043E\u043C\u0438\u043B\u043A\u0430\u043C\u0438: {n}",
      "set.lang.invalid": "\u041D\u0435\u0434\u043E\u043F\u0443\u0441\u0442\u0438\u043C\u0438\u0439 \u043C\u043E\u0434\u0443\u043B\u044C: {error}",
      "set.linkFirstOnly.desc": "\u041F\u0435\u0440\u0435\u0442\u0432\u043E\u0440\u044E\u044E\u0447\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u043D\u0430 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F, \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u0442\u0438 \u043B\u0438\u0448\u0435 \u043F\u0435\u0440\u0448\u0435 \u0432\u0445\u043E\u0434\u0436\u0435\u043D\u043D\u044F \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u0442\u0435\u0440\u043C\u0456\u043D\u0430 \u043D\u0430 \u0441\u0442\u043E\u0440\u0456\u043D\u0446\u0456.",
      "set.excludeTerms.name": "\u0412\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0456 \u0442\u0435\u0440\u043C\u0456\u043D\u0438",
      "set.excludeTerms.desc": "\u041D\u0430\u0437\u0432\u0438 \u0430\u0431\u043E \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432, \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0440\u044F\u0434\u043E\u043A \u2014 \u043F\u0440\u0438\u0431\u0438\u0440\u0430\u044E\u0442\u044C \u0443\u0432\u0435\u0441\u044C \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0438\u0439 \u0437\u0430\u043F\u0438\u0441 \u0437 \u0456\u043D\u0434\u0435\u043A\u0441\u0443.",
      "set.excludeWords.name": "\u0412\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0456 \u0441\u043B\u043E\u0432\u0430",
      "set.excludeWords.desc": "\u0421\u043B\u043E\u0432\u0430 \u0432 \u0442\u0435\u043A\u0441\u0442\u0456, \u043F\u043E \u043E\u0434\u043D\u043E\u043C\u0443 \u043D\u0430 \u0440\u044F\u0434\u043E\u043A, \u0449\u043E \u043D\u0456\u043A\u043E\u043B\u0438 \u043D\u0435 \u0434\u0430\u044E\u0442\u044C \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F, \u043D\u0430\u0432\u0456\u0442\u044C \u044F\u043A\u0449\u043E \u0437\u0431\u0456\u0433\u0430\u044E\u0442\u044C\u0441\u044F \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C.",
      "set.highlightInReading.desc": "\u041F\u0456\u0434\u043A\u0440\u0435\u0441\u043B\u044E\u0432\u0430\u0442\u0438 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u0456 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u044F\u043A \u043A\u043B\u0456\u043A\u0430\u0431\u0435\u043B\u044C\u043D\u0456 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u0432 \u0440\u0435\u0436\u0438\u043C\u0456 \u0447\u0438\u0442\u0430\u043D\u043D\u044F (\u0444\u0430\u0439\u043B \u043D\u0435 \u0437\u043C\u0456\u043D\u044E\u0454\u0442\u044C\u0441\u044F).",
      "set.editingHighlight.name": "\u041F\u0456\u0434\u0441\u0432\u0456\u0447\u0443\u0432\u0430\u0442\u0438 \u043F\u0456\u0434 \u0447\u0430\u0441 \u0440\u0435\u0434\u0430\u0433\u0443\u0432\u0430\u043D\u043D\u044F",
      "set.editingHighlight.desc": "\u041F\u0456\u0434\u043A\u0440\u0435\u0441\u043B\u044E\u0432\u0430\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u0456 \u0432 \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0456 (Live Preview / Source).",
      "set.editingHighlight.off": "\u0412\u0438\u043C\u043A.",
      "set.editingHighlight.live": "\u041D\u0430 \u043B\u044C\u043E\u0442\u0443 (\u043F\u0456\u0434 \u0447\u0430\u0441 \u043D\u0430\u0431\u043E\u0440\u0443)",
      "set.skipHeadings.desc": "\u041D\u0435 \u043F\u0456\u0434\u0441\u0432\u0456\u0447\u0443\u0432\u0430\u0442\u0438 \u0439 \u043D\u0435 \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u0432\u0441\u0435\u0440\u0435\u0434\u0438\u043D\u0456 \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0456\u0432 Markdown.",
      "set.statusBar.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0432 \u0440\u044F\u0434\u043A\u0443 \u0441\u0442\u0430\u043D\u0443, \u0441\u043A\u0456\u043B\u044C\u043A\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F \u0432 \u043F\u043E\u0442\u043E\u0447\u043D\u0456\u0439 \u043D\u043E\u0442\u0430\u0442\u0446\u0456.",
      "set.statusBarIncludeLinks.name": "\u0420\u0430\u0445\u0443\u0432\u0430\u0442\u0438 \u043F\u0440\u044F\u043C\u0456 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F",
      "set.statusBarIncludeLinks.desc": "\u0422\u0430\u043A\u043E\u0436 \u0440\u0430\u0445\u0443\u0432\u0430\u0442\u0438 \u0432\u0436\u0435 \u0437\u0432\u2019\u044F\u0437\u0430\u043D\u0456 \u0442\u0435\u0440\u043C\u0456\u043D\u0438, \u0430 \u043D\u0435 \u043B\u0438\u0448\u0435 \u0437\u0433\u0430\u0434\u043A\u0438 \u0432 \u0442\u0435\u043A\u0441\u0442\u0456.",
      "set.linkSuggest.desc": "\u041F\u0456\u0434 \u0447\u0430\u0441 \u043D\u0430\u0431\u043E\u0440\u0443 \u0432 \u043D\u043E\u0442\u0430\u0442\u0446\u0456 \u0437 \u043E\u0431\u043B\u0430\u0441\u0442\u0456 \u043F\u0440\u043E\u043F\u043E\u043D\u0443\u0432\u0430\u0442\u0438 \u0432\u0441\u0442\u0430\u0432\u0438\u0442\u0438 [[\u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F]] \u043D\u0430 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u043D\u0438\u0439 \u0442\u0435\u0440\u043C\u0456\u043D \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F (\u0437\u0430 \u043F\u043E\u0447\u0430\u0442\u043A\u043E\u043C \u043D\u0430\u0437\u0432\u0438/\u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0430 \u0430\u0431\u043E \u0437\u0430 \u0441\u043B\u043E\u0432\u043E\u0444\u043E\u0440\u043C\u043E\u044E).",
      "set.suggestMinChars.name": "\u041C\u0456\u043D\u0456\u043C\u0443\u043C \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432",
      "set.suggestSkipAfter.desc": "\u041D\u0435 \u043F\u0456\u0434\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438, \u044F\u043A\u0449\u043E \u0441\u043B\u043E\u0432\u043E \u0439\u0434\u0435 \u043E\u0434\u0440\u0430\u0437\u0443 \u043F\u0456\u0441\u043B\u044F \u043E\u0434\u043D\u043E\u0433\u043E \u0437 \u0446\u0438\u0445 \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432 \u2014 \u0449\u043E\u0431 \u0456\u043D\u0448\u0456 \u043F\u0456\u0434\u043A\u0430\u0437\u043A\u0438 (\u0442\u0435\u0433\u0438, \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u043A\u043E\u0434, \u0444\u043E\u0440\u043C\u0443\u043B\u0438) \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u043B\u0438 \u0441\u0432\u0456\u0439 \u0441\u043B\u043E\u0442. \u041F\u043E\u0440\u043E\u0436\u043D\u044C\u043E \u2014 \u0432\u0438\u043C\u043A\u043D\u0443\u0442\u0438.",
      "set.aliasHarvestMode.name": "\u0424\u043E\u0440\u043C\u0430 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0430",
      "set.aliasHarvestMode.desc": "\u042F\u043A \u0437\u0456\u0431\u0440\u0430\u043D\u0438\u0439 \u0442\u0435\u043A\u0441\u0442 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u0437\u0431\u0435\u0440\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u044F\u043A \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C.",
      "set.aliasHarvestMode.lemma": "\u041F\u043E\u0447\u0430\u0442\u043A\u043E\u0432\u0430 \u0444\u043E\u0440\u043C\u0430",
      "set.aliasHarvestMode.literal": "\u042F\u043A \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043E",
      "set.aliasHarvestMode.both": "\u041E\u0431\u0438\u0434\u0432\u0456",
      "set.harvestOnSave.name": "\u0417\u0431\u0438\u0440\u0430\u0442\u0438 \u043F\u0456\u0434 \u0447\u0430\u0441 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F",
      "set.harvestOnSave.desc": "\u0410\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u0437\u0431\u0438\u0440\u0430\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u043F\u0456\u0434 \u0447\u0430\u0441 \u0437\u0431\u0435\u0440\u0435\u0436\u0435\u043D\u043D\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0438.",
      "set.harvestOnSave.off": "\u0412\u0438\u043C\u043A.",
      "set.harvestOnSave.silent": "\u0422\u0438\u0445\u043E (\u0434\u043E\u0434\u0430\u0432\u0430\u0442\u0438 \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E)",
      "set.harvestOnSave.preview": "\u0421\u043F\u043E\u0447\u0430\u0442\u043A\u0443 \u0437\u0430\u043F\u0438\u0442\u0443\u0432\u0430\u0442\u0438",
      "set.harvestSingleWordOnly.name": "\u041B\u0438\u0448\u0435 \u043E\u0434\u043D\u043E\u0441\u043B\u0456\u0432\u043D\u0456 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438",
      "set.harvestSingleWordOnly.desc": "\u0417\u0431\u0438\u0440\u0430\u0442\u0438 \u043B\u0438\u0448\u0435 \u0442\u0435\u043A\u0441\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C \u0437 \u043E\u0434\u043D\u043E\u0433\u043E \u0441\u043B\u043E\u0432\u0430.",
      "set.harvestMinLength.name": "\u041C\u0456\u043D\u0456\u043C\u0430\u043B\u044C\u043D\u0430 \u0434\u043E\u0432\u0436\u0438\u043D\u0430 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0430",
      "set.harvestMinLength.desc": "\u0406\u0433\u043D\u043E\u0440\u0443\u0432\u0430\u0442\u0438 \u0437\u0456\u0431\u0440\u0430\u043D\u0456 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u043A\u043E\u0440\u043E\u0442\u0448\u0456 \u0437\u0430 \u0432\u043A\u0430\u0437\u0430\u043D\u0443 \u043A\u0456\u043B\u044C\u043A\u0456\u0441\u0442\u044C \u0441\u0438\u043C\u0432\u043E\u043B\u0456\u0432.",
      "set.aliasCollisionWarnings.name": "\u041F\u043E\u043F\u0435\u0440\u0435\u0434\u0436\u0430\u0442\u0438 \u043F\u0440\u043E \u043A\u043E\u043D\u0444\u043B\u0456\u043A\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0456\u0432",
      "set.aliasCollisionWarnings.desc": "\u0417\u0431\u0438\u0440\u0430\u044E\u0447\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C \u0430\u0431\u043E \u0441\u0442\u0432\u043E\u0440\u044E\u044E\u0447\u0438 \u0442\u0435\u0440\u043C\u0456\u043D, \u043F\u043E\u0437\u043D\u0430\u0447\u0430\u0442\u0438 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F, \u0449\u043E \u0432\u0436\u0435 \u0432\u0456\u0434\u043F\u043E\u0432\u0456\u0434\u0430\u0454 \u0456\u043D\u0448\u043E\u043C\u0443 \u0442\u0435\u0440\u043C\u0456\u043D\u0443 (\u0449\u043E\u0431 \u0441\u043B\u043E\u0432\u043E \u043D\u0435 \u0432\u043A\u0430\u0437\u0443\u0432\u0430\u043B\u043E \u043D\u0430 \u0434\u0432\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0438).",
      "set.menuTurnInto.name": "\u041F\u0443\u043D\u043A\u0442\u0438 \xAB\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C\xBB",
      "set.menuTurnInto.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C\u0443 \u043C\u0435\u043D\u044E \u0442\u0435\u0440\u043C\u0456\u043D\u0430 \u0434\u0456\u0457 \xAB\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C\xBB / \xAB\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0432\u0441\u0456 \u2026 \u0437 \u0442\u0435\u0440\u043C\u0456\u043D\u043E\u043C\xBB.",
      "set.menuCollect.name": "\u041F\u0443\u043D\u043A\u0442 \xAB\u0417\u0456\u0431\u0440\u0430\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438\xBB",
      "set.menuCollect.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \xAB\u0417\u0456\u0431\u0440\u0430\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u0437 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C (\u0446\u044F \u043D\u043E\u0442\u0430\u0442\u043A\u0430)\xBB \u0443 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C\u0443 \u043C\u0435\u043D\u044E \u0440\u0435\u0434\u0430\u043A\u0442\u043E\u0440\u0430.",
      "set.menuExclude.name": "\u041F\u0443\u043D\u043A\u0442\u0438 \xAB\u0412\u0438\u043A\u043B\u044E\u0447\u0438\u0442\u0438 \u0441\u043B\u043E\u0432\u043E / \u0442\u0435\u0440\u043C\u0456\u043D\xBB",
      "set.menuExclude.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C\u0443 \u043C\u0435\u043D\u044E \u043F\u0443\u043D\u043A\u0442\u0438 \xAB\u0414\u043E\u0434\u0430\u0442\u0438 \u2026 \u0434\u043E \u0432\u0438\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0445 \u0441\u043B\u0456\u0432 / \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432\xBB.",
      "set.menuOpen.name": "\u041F\u0443\u043D\u043A\u0442\u0438 \xAB\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F\xBB",
      "set.menuOpen.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C\u0443 \u043C\u0435\u043D\u044E \u0442\u0435\u0440\u043C\u0456\u043D\u0430 \xAB\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043D\u043E\u0442\u0430\u0442\u043A\u0443 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F\xBB / \xAB\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u0432 \u043D\u043E\u0432\u0456\u0439 \u0432\u043A\u043B\u0430\u0434\u0446\u0456\xBB.",
      "set.menuCreateTerm.name": "\u041F\u0443\u043D\u043A\u0442\u0438 \xAB\u0421\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D \u0437 \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043D\u044F\xBB",
      "set.menuCreateTerm.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C\u0443 \u043C\u0435\u043D\u044E \u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043E\u0433\u043E \u0442\u0435\u043A\u0441\u0442\u0443 \u0434\u0456\u0457 \xABGlossary: \u0441\u0442\u0432\u043E\u0440\u0438\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u2026\xBB.",
      "set.menuUnlink.name": "\u041F\u0443\u043D\u043A\u0442 \xAB\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\xBB",
      "set.menuUnlink.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u0432 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u043D\u043E\u043C\u0443 \u043C\u0435\u043D\u044E \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \xABGlossary: \u043F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0446\u0435\u0439 \u0442\u0435\u0440\u043C\u0456\u043D\xBB.",
      "set.showRibbonIcon.name": "\u0417\u043D\u0430\u0447\u043E\u043A \u043D\u0430 \u0431\u0456\u0447\u043D\u0456\u0439 \u043F\u0430\u043D\u0435\u043B\u0456",
      "set.showRibbonIcon.desc": "\u041F\u043E\u043A\u0430\u0437\u0443\u0432\u0430\u0442\u0438 \u043A\u043D\u043E\u043F\u043A\u0443 \u043D\u0430 \u0431\u0456\u0447\u043D\u0456\u0439 \u043F\u0430\u043D\u0435\u043B\u0456, \u0449\u043E \u0432\u0456\u0434\u043A\u0440\u0438\u0432\u0430\u0454 \u043F\u0430\u043D\u0435\u043B\u044C \u043E\u0433\u043B\u044F\u0434\u0443 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F. \u041A\u043E\u043C\u0430\u043D\u0434\u0430 \xAB\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u043E\u0433\u043B\u044F\u0434 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F\xBB \u043F\u0440\u0430\u0446\u044E\u0454 \u0432 \u0431\u0443\u0434\u044C-\u044F\u043A\u043E\u043C\u0443 \u0440\u0430\u0437\u0456.",
      "set.rebuild.name": "\u041F\u0435\u0440\u0435\u0431\u0443\u0434\u0443\u0432\u0430\u0442\u0438 \u0456\u043D\u0434\u0435\u043A\u0441 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F",
      "set.rebuild.desc": "\u041F\u0435\u0440\u0435\u0441\u043A\u0430\u043D\u0443\u0432\u0430\u0442\u0438 \u0442\u0435\u043A\u0443 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F \u0437\u0430\u0440\u0430\u0437.",
      "set.collecting.desc": "\u0427\u0438\u0442\u0430\u0454 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F, \u044F\u043A\u0456 \u0432\u0438 \u0437\u0440\u043E\u0431\u0438\u043B\u0438 \u0432\u0440\u0443\u0447\u043D\u0443, \u043D\u0430 \u043A\u0448\u0442\u0430\u043B\u0442 [[\u0422\u0435\u0440\u043C\u0456\u043D|\u044F\u043A\u0435\u0441\u044C \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F]], \u0456 \u0434\u043E\u0434\u0430\u0454 \u0446\u0435 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0434\u043E \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0456\u0432 \u0442\u0435\u0440\u043C\u0456\u043D\u0430 \u2014 \u0449\u043E\u0431 \u0442\u0435 \u0441\u0430\u043C\u0435 \u043D\u0430\u043F\u0438\u0441\u0430\u043D\u043D\u044F \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043B\u043E\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u043D\u043E \u043D\u0430\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u0440\u0430\u0437\u0443.",
      "set.folderNotFound": "\u26A0 \u0422\u0435\u043A\u0443 \u043D\u0435 \u0437\u043D\u0430\u0439\u0434\u0435\u043D\u043E \u2014 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u043D\u0435 \u0431\u0443\u0434\u0443\u0442\u044C \u043F\u0440\u043E\u0456\u043D\u0434\u0435\u043A\u0441\u043E\u0432\u0430\u043D\u0456.",
      "set.termsIndexed": "\u041F\u0440\u043E\u0456\u043D\u0434\u0435\u043A\u0441\u043E\u0432\u0430\u043D\u043E: {terms}.",
      "modal.materialize.title": "\u0417\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u0433\u043B\u043E\u0441\u0430\u0440\u0456\u044F \u2014 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434",
      "modal.materialize.summary": "\u0424\u0430\u0439\u043B\u0456\u0432: {files}, \u0437\u0430\u043C\u0456\u043D: {replacements}",
      "modal.materialize.ambiguous": "\u041D\u0435\u043E\u0434\u043D\u043E\u0437\u043D\u0430\u0447\u043D\u0438\u0445 \u0441\u043B\u0456\u0432, \u0449\u043E \u0437\u0431\u0456\u0433\u0430\u044E\u0442\u044C\u0441\u044F \u0437 \u043A\u0456\u043B\u044C\u043A\u043E\u043C\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0430\u043C\u0438: {n} \u2014 \u0432\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u043E\u0434\u043D\u0435 (\u0437\u0430\u0441\u0442\u043E\u0441\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F \u0434\u043E \u043A\u043E\u0436\u043D\u043E\u0433\u043E \u0432\u0445\u043E\u0434\u0436\u0435\u043D\u043D\u044F):",
      "modal.skipOption": "(\u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u0438 \u2014 \u0437\u0430\u043B\u0438\u0448\u0438\u0442\u0438 \u0442\u0435\u043A\u0441\u0442\u043E\u043C)",
      "modal.leftAsText": "\u2014 \u0437\u0430\u043B\u0438\u0448\u0435\u043D\u043E \u0442\u0435\u043A\u0441\u0442\u043E\u043C \u2014",
      "modal.harvest.title": "\u0417\u0456\u0431\u0440\u0430\u0442\u0438 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438 \u2014 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434",
      "modal.harvest.summary": "\u0422\u0435\u0440\u043C\u0456\u043D\u0456\u0432: {terms}, \u043D\u043E\u0432\u0438\u0445 \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0456\u0432: {aliases}",
      "modal.harvest.alsoMatches": "\u0422\u0430\u043A\u043E\u0436 \u0437\u0431\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u0437: {terms}",
      "modal.harvest.alreadyPresent": "\u0423\u0436\u0435 \u043D\u0430\u044F\u0432\u043D\u0456 (\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u043E): {items}",
      "modal.unlink.title": "\u041F\u0440\u0438\u0431\u0440\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F \u043D\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0438 \u2014 \u043F\u043E\u043F\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u043F\u0435\u0440\u0435\u0433\u043B\u044F\u0434",
      "modal.unlink.summary": "\u0424\u0430\u0439\u043B\u0456\u0432: {files}, \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C \u0434\u043E \u0432\u0438\u0434\u0430\u043B\u0435\u043D\u043D\u044F: {links}",
      "modal.choose.body": "\u0426\u0435 \u0441\u043B\u043E\u0432\u043E \u0437\u0431\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u0437 \u043A\u0456\u043B\u044C\u043A\u043E\u043C\u0430 \u0442\u0435\u0440\u043C\u0456\u043D\u0430\u043C\u0438 \u2014 \u0432\u0438\u0431\u0435\u0440\u0456\u0442\u044C \u043E\u0434\u0438\u043D:",
      "btn.write": "\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u0438",
      "label.selection": "\u0432\u0438\u0434\u0456\u043B\u0435\u043D\u043D\u044F",
      "view.title": "\u0413\u043B\u043E\u0441\u0430\u0440\u0456\u0439",
      "overview.rescan": "\u041F\u0435\u0440\u0435\u0441\u043A\u0430\u043D\u0443\u0432\u0430\u0442\u0438",
      "overview.wholeVault": "\u0443\u0441\u0435 \u0441\u0445\u043E\u0432\u0438\u0449\u0435",
      "overview.wholeVaultAria": "\u0421\u043A\u0430\u043D\u0443\u0432\u0430\u0442\u0438 \u0432\u0441\u0456 \u043D\u043E\u0442\u0430\u0442\u043A\u0438, \u0430 \u043D\u0435 \u043B\u0438\u0448\u0435 \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u0437\u0432\u2019\u044F\u0437\u0443\u0432\u0430\u043D\u043D\u044F",
      "overview.terms": "\u0422\u0435\u0440\u043C\u0456\u043D\u0438",
      "overview.candidates": "\u041A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u0438",
      "overview.sort": "\u0421\u043E\u0440\u0442\u0443\u0432\u0430\u043D\u043D\u044F",
      "overview.sortMostUsed": "\u0417\u0430 \u0447\u0430\u0441\u0442\u043E\u0442\u043E\u044E",
      "overview.sortName": "\u0417\u0430 \u043D\u0430\u0437\u0432\u043E\u044E",
      "overview.countLinks": "\u0440\u0430\u0445\u0443\u0432\u0430\u0442\u0438 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F",
      "overview.countLinksAria": "\u0422\u0430\u043A\u043E\u0436 \u0440\u0430\u0445\u0443\u0432\u0430\u0442\u0438 \u043D\u0430\u044F\u0432\u043D\u0456 \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F [[\u0422\u0435\u0440\u043C\u0456\u043D]], \u0430 \u043D\u0435 \u043B\u0438\u0448\u0435 \u0437\u0433\u0430\u0434\u043A\u0438 \u0432 \u0442\u0435\u043A\u0441\u0442\u0456",
      "overview.noTerms": "\u0422\u0435\u0440\u043C\u0456\u043D\u0438 \u043D\u0435 \u043F\u0440\u043E\u0456\u043D\u0434\u0435\u043A\u0441\u043E\u0432\u0430\u043D\u0456.",
      "overview.openAria": "\u0412\u0456\u0434\u043A\u0440\u0438\u0442\u0438 \u2014 \u0441\u0435\u0440\u0435\u0434\u043D\u0456\u0439 \u043A\u043B\u0456\u043A \u0434\u043B\u044F \u043D\u043E\u0432\u043E\u0457 \u0432\u043A\u043B\u0430\u0434\u043A\u0438",
      "overview.unused": "\u043D\u0435 \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u043E\u0432\u0443\u0454\u0442\u044C\u0441\u044F \u26A0",
      "overview.linkAll": "\u0437\u0432\u2019\u044F\u0437\u0430\u0442\u0438 \u0432\u0441\u0456",
      "overview.sortNotes": "\u0417\u0430 \u043D\u043E\u0442\u0430\u0442\u043A\u0430\u043C\u0438",
      "overview.sortMentions": "\u0417\u0430 \u0437\u0433\u0430\u0434\u043A\u0430\u043C\u0438",
      "overview.minNotes": "\u041C\u0456\u043D. \u043D\u043E\u0442\u0430\u0442\u043E\u043A",
      "overview.noCandidates": "\u041A\u0430\u043D\u0434\u0438\u0434\u0430\u0442\u0456\u0432 \u043D\u0435\u043C\u0430\u0454.",
      "overview.addTerm": "+ \u0442\u0435\u0440\u043C\u0456\u043D",
      "suggest.inflection": "\u0441\u043B\u043E\u0432\u043E\u0444\u043E\u0440\u043C\u0430",
      "suggest.alias": "\u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C: {form}",
      "highlight.matches": "\u0417\u0431\u0456\u0433\u0430\u0454\u0442\u044C\u0441\u044F \u0437: {terms}",
      "plural.term": { one: "{n} \u0442\u0435\u0440\u043C\u0456\u043D", few: "{n} \u0442\u0435\u0440\u043C\u0456\u043D\u0438", many: "{n} \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432", other: "{n} \u0442\u0435\u0440\u043C\u0456\u043D\u0456\u0432" },
      "plural.use": { one: "{n} \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F", few: "{n} \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u043D\u044F", many: "{n} \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u044C", other: "{n} \u0432\u0438\u043A\u043E\u0440\u0438\u0441\u0442\u0430\u043D\u044C" },
      "plural.note": { one: "{n} \u043D\u043E\u0442\u0430\u0442\u043A\u0430", few: "{n} \u043D\u043E\u0442\u0430\u0442\u043A\u0438", many: "{n} \u043D\u043E\u0442\u0430\u0442\u043E\u043A", other: "{n} \u043D\u043E\u0442\u0430\u0442\u043E\u043A" },
      "plural.link": { one: "{n} \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F", few: "{n} \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u043D\u044F", many: "{n} \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C", other: "{n} \u043F\u043E\u0441\u0438\u043B\u0430\u043D\u044C" },
      "plural.file": { one: "{n} \u0444\u0430\u0439\u043B", few: "{n} \u0444\u0430\u0439\u043B\u0438", many: "{n} \u0444\u0430\u0439\u043B\u0456\u0432", other: "{n} \u0444\u0430\u0439\u043B\u0456\u0432" },
      "plural.alias": { one: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C", few: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0438", many: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0456\u0432", other: "{n} \u043F\u0441\u0435\u0432\u0434\u043E\u043D\u0456\u043C\u0456\u0432" }
    };
  }
});

// src/main.js
var { Plugin, Notice, TFile, TFolder, debounce } = require("obsidian");
var { DEFAULT_SETTINGS, sanitizeFolder } = require_constants();
var { splitLines, inTableCell } = require_markdown();
var { BUILTIN_LANGUAGES } = require_builtin_languages();
var { validateLanguage } = require_language_api();
var { GlossaryLinkerSettingTab } = require_settings_tab();
var matcher = require_matcher2();
var highlight = require_highlight2();
var actions = require_actions();
var api = require_api();
var indexEvents = require_index_events();
var { GlossaryTermSuggest, suggestAvailable } = require_term_suggest();
var { GlossaryOverviewView, OVERVIEW_VIEW_TYPE } = require_overview_view();
var { initI18n, withFamily, t, plural } = require_i18n();
var { menuSection } = require_menu();
var { ChoicePopover } = require_choices();
var GlossaryLinkerPlugin = class extends Plugin {
  async onload() {
    initI18n(withFamily("prose", {
      en: require_en2(),
      ru: require_ru2(),
      de: require_de2(),
      es: require_es2(),
      fr: require_fr2(),
      uk: require_uk2()
    }));
    const loaded = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loaded);
    if (loaded) {
      if (typeof loaded.linkFolders === "string" && loaded.scopeFolders === void 0)
        this.settings.scopeFolders = loaded.linkFolders;
      if (typeof loaded.harvestOnSave === "boolean")
        this.settings.harvestOnSave = loaded.harvestOnSave ? "silent" : "off";
      if (typeof loaded.highlightInLivePreview === "boolean" && loaded.editingHighlight === void 0)
        this.settings.editingHighlight = loaded.highlightInLivePreview ? "live" : "off";
    }
    this.settings.glossaryFolder = sanitizeFolder(this.settings.glossaryFolder);
    this.languages = [];
    this.activeLanguages = [];
    this.languageErrors = [];
    this.index = { byKey: /* @__PURE__ */ new Map(), termCount: 0 };
    this.excludeWordKeys = /* @__PURE__ */ new Set();
    this.keysCache = /* @__PURE__ */ new Map();
    this.terms = [];
    this.aliasFingerprints = /* @__PURE__ */ new Map();
    this._indexListeners = /* @__PURE__ */ new Set();
    await this.loadLanguages();
    this.rebuildIndex();
    this.scheduleRebuild = debounce(() => {
      this.rebuildIndex();
      this.rerenderViews();
      this.updateStatusBar();
    }, 600, true);
    this.refreshOverviewDebounced = debounce(() => this.refreshOverview(), 800, true);
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("mod-clickable");
    this.registerDomEvent(this.statusBarEl, "click", () => this.materializeCurrent());
    this.updateStatusBarDebounced = debounce(() => this.updateStatusBar(), 400, true);
    this.registerEvent(this.app.workspace.on("file-open", () => this.updateStatusBarDebounced()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.updateStatusBarDebounced()));
    this.app.workspace.onLayoutReady(() => {
      this.rebuildIndex();
      this.updateStatusBar();
    });
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (!this.isGlossaryPath(file.path))
        return;
      const next = JSON.stringify(this.aliasesOf(file));
      if (this.aliasFingerprints.get(file.path) === next)
        return;
      this.aliasFingerprints.set(file.path, next);
      this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on("create", (file) => {
      if (this.isGlossaryPath(file.path))
        this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      if (!this.isGlossaryPath(file.path))
        return;
      this.aliasFingerprints.delete(file.path);
      this.scheduleRebuild();
    }));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      if (!this.isGlossaryPath(file.path) && !this.isGlossaryPath(oldPath))
        return;
      this.aliasFingerprints.delete(oldPath);
      this.scheduleRebuild();
    }));
    this.harvestOnSaveDebounced = debounce((file) => this.harvestFiles([file], this.settings.harvestOnSave !== "preview"), 1500, true);
    this.registerEvent(this.app.vault.on("modify", (file) => {
      if (file.extension !== "md")
        return;
      if (this.settings.harvestOnSave !== "off" && this.inScope(file.path))
        this.harvestOnSaveDebounced(file);
      if (this.settings.editingHighlight === "onSave")
        this.refreshEditors();
      const active = this.app.workspace.getActiveFile();
      if (active && active.path === file.path)
        this.updateStatusBarDebounced();
    }));
    this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor) => {
      const sel = editor.getSelection().trim();
      const hasSel = !!sel && !sel.includes("\n");
      const link = this.glossaryLinkAt(editor);
      const file = this.app.workspace.getActiveFile();
      const sourcePath = file ? file.path : "";
      const excludeItems = (value, ...listKeys) => {
        if (!this.settings.menuExclude)
          return;
        for (const key of listKeys)
          this.addExclusionMenuItem(menu, key, value);
      };
      if (link) {
        if (this.settings.menuUnlink) {
          menu.addItem((i) => i.setTitle(t("menu.unlinkThisTerm")).setIcon("unlink").onClick(() => this.unlinkLinkAt(editor, link)));
        }
        if (this.settings.menuCollect && link.targetFile) {
          menu.addItem((i) => i.setTitle(t("menu.collectThisAlias")).setIcon("download").onClick(() => this.harvestOneLink(link.targetFile, link.display)));
        }
        excludeItems(link.display, "excludeWords", "excludeTerms");
        return;
      }
      if (hasSel) {
        if (this.settings.menuCreateTerm) {
          menu.addItem((i) => i.setTitle(t("menu.createTermLink")).setIcon("plus-circle").onClick(() => this.createTermFromSelection(editor, true)));
          menu.addItem((i) => i.setTitle(t("menu.createTerm")).setIcon("file-plus").onClick(() => this.createTermFromSelection(editor, false)));
        }
        if (this.settings.menuAddAlias) {
          menu.addItem((i) => i.setTitle(t("menu.addAlias")).setIcon("text-cursor-input").onClick(() => this.addAliasFromSelection(sel)));
        }
        excludeItems(sel, "excludeWords");
        return;
      }
      const hit = this.matchAtCursor(editor);
      if (hit) {
        const display = hit.match.display;
        const canonical = hit.match.canonical;
        const candidates = () => this.cursorCandidates(hit, sourcePath, false);
        if (file && this.settings.menuTurnInto) {
          const scope = this.settings.linkFirstOnly ? t("scope.first") : t("scope.all");
          const linkGroup = menuSection(menu, t("menu.linkThisWord", { display }), true, "link");
          linkGroup.addItem((i) => i.setTitle(t("menu.linkHere", { display })).setIcon("link").onClick(() => this.chooseTerm(
            candidates(),
            t("menu.linkDisplayTo", { display }),
            (c) => this.materializeSingle(file, canonical, display, editor.posToOffset({ line: hit.line, ch: hit.match.start }), 0, c)
          )));
          linkGroup.addItem((i) => i.setTitle(t("menu.linkScopeThisNote", { scope, display })).setIcon("links-coming-in").onClick(() => this.chooseTerm(
            candidates(),
            t("menu.linkScopeTo", { scope, display }),
            (c) => this.materializeTerm(file, canonical, c)
          )));
          linkGroup.addItem((i) => i.setTitle(t("menu.linkScopeAllNotes", { scope, display })).setIcon("links-going-out").onClick(() => this.chooseTerm(
            candidates(),
            t("menu.linkScopeTo", { scope, display }),
            (c) => this.materializeTermScope(canonical, c)
          )));
        }
        if (this.settings.menuOpen) {
          menu.addItem((i) => i.setTitle(t("menu.openThisWord", { display })).setIcon("file-text").onClick(() => this.chooseTerm(candidates(), t("menu.openTitle"), (c) => this.openTerm(c, sourcePath, false))));
        }
        excludeItems(display, "excludeTerms");
        return;
      }
      const word = this.wordAtCursor(editor);
      if (word) {
        excludeItems(word.canonical, "excludeTerms");
        return;
      }
    }));
    this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
      if (source === "link-context-menu")
        return;
      const isFolder = file instanceof TFolder;
      if (!isFolder && !(file instanceof TFile && file.extension === "md"))
        return;
      const path = file.path;
      const noun = isFolder ? t("noun.folder") : t("noun.file");
      const item = (title, icon, listKey, add) => menu.addItem((i) => i.setTitle(title).setIcon(icon).onClick(() => this.setPathInList(listKey, path, add)));
      if (this.pathListed("excludeFolders", path)) {
        item(t("menu.removeFromAlwaysExcluded"), "rotate-ccw", "excludeFolders", false);
      } else {
        item(t("menu.addToAlwaysExcluded", { noun }), "ban", "excludeFolders", true);
      }
      if (this.settings.scopeMode === "folders") {
        const listed = this.pathListed("scopeFolders", path);
        if (listed)
          item(t("menu.removeFromScope", { noun }), "folder-minus", "scopeFolders", false);
        else
          item(t("menu.includeInScope", { noun }), "folder-plus", "scopeFolders", true);
      }
      if (this.settings.menuCollect && !isFolder) {
        menu.addItem((i) => i.setTitle(t("menu.collectFromNote")).setIcon("download").onClick(() => this.harvestFiles([file], false)));
      }
    }));
    this.app.workspace.registerHoverLinkSource("glossary-linker", { display: "Glossary Linker", defaultMod: true });
    this.app.workspace.registerHoverLinkSource("glossary-linker-choice", { display: "Glossary Linker", defaultMod: false });
    this.choices = new ChoicePopover({
      cls: "glossary",
      title: t("modal.choose.title"),
      hover: (target, event, row, parent) => this.hoverTerm(event, row, target, this.activePath(), parent),
      open: (target) => this.openTerm(target, this.activePath(), false)
    });
    this.register(() => this.choices.destroy());
    this.registerMarkdownPostProcessor((el, ctx) => this.processReadingMode(el, ctx));
    this.registerEditingHighlight();
    if (suggestAvailable())
      this.registerEditorSuggest(new GlossaryTermSuggest(this.app, this));
    this.registerView(OVERVIEW_VIEW_TYPE, (leaf) => new GlossaryOverviewView(leaf, this));
    this.applyRibbonIcon();
    this.addCommand({
      id: "open-overview",
      name: t("cmd.openOverview"),
      callback: () => this.activateOverview()
    });
    this.addCommand({
      id: "materialize-current",
      name: t("cmd.linkThisNote"),
      callback: () => this.materializeCurrent()
    });
    this.addCommand({
      id: "materialize-selection",
      name: t("cmd.linkSelection"),
      editorCallback: (editor) => this.materializeSelection(editor)
    });
    this.addCommand({
      id: "materialize-scope",
      name: t("cmd.linkAllNotes"),
      callback: () => this.materializeScope()
    });
    this.addCommand({
      id: "unlink-current",
      name: t("cmd.unlinkThisNote"),
      callback: () => this.unlinkCurrent()
    });
    this.addCommand({
      id: "unlink-selection",
      name: t("cmd.unlinkSelection"),
      editorCallback: (editor) => this.unlinkSelection(editor)
    });
    this.addCommand({
      id: "unlink-scope",
      name: t("cmd.unlinkAllNotes"),
      callback: () => this.unlinkScope()
    });
    this.addCommand({
      id: "harvest-current",
      name: t("cmd.collectThisNote"),
      callback: () => {
        const f = this.app.workspace.getActiveFile();
        if (f)
          this.harvestFiles([f], false);
      }
    });
    this.addCommand({
      id: "harvest-scope",
      name: t("cmd.collectAllNotes"),
      callback: () => this.harvestFiles(this.getScopeFiles(), false)
    });
    this.addCommand({
      id: "create-term-from-selection",
      name: t("cmd.createTerm"),
      editorCallback: (editor) => this.createTermFromSelection(editor, true)
    });
    this.addCommand({
      id: "rebuild-index",
      name: t("cmd.rebuildIndex"),
      callback: () => {
        this.rebuildIndex();
        new Notice(t("notice.indexRebuilt"));
      }
    });
    this.addCommand({
      id: "add-alias",
      name: t("cmd.addAlias"),
      callback: () => this.addAlias()
    });
    this.addSettingTab(new GlossaryLinkerSettingTab(this.app, this));
    this.api = this.buildApi();
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async loadLanguages() {
    this.languages = [];
    this.languageErrors = [];
    const seen = /* @__PURE__ */ new Set();
    for (const lang of BUILTIN_LANGUAGES) {
      const id = lang && lang.id;
      const error = validateLanguage(lang);
      if (error) {
        this.languageErrors.push({ id: id || "?", error });
        continue;
      }
      if (seen.has(id)) {
        this.languageErrors.push({ id, error: `duplicate id "${id}"` });
        continue;
      }
      seen.add(id);
      this.languages.push(lang);
    }
    this.sortLanguages();
    this.languageErrors.sort((a, b) => a.id.localeCompare(b.id));
    if (!Array.isArray(this.settings.enabledLanguages)) {
      const sys = (window.localStorage.getItem("language") || "").split("-")[0].toLowerCase();
      const wanted = /* @__PURE__ */ new Set(["en"]);
      if (sys && this.languages.some((l) => l.id === sys))
        wanted.add(sys);
      this.settings.enabledLanguages = this.languages.filter((l) => wanted.has(l.id)).map((l) => l.id);
      await this.saveSettings();
    }
    this.refreshActiveLanguages();
  }
  sortLanguages() {
    const order = this.settings.languageOrder || [];
    const rank = (l) => {
      const i = order.indexOf(l.id);
      return i === -1 ? Infinity : i;
    };
    this.languages.sort((a, b) => rank(a) - rank(b) || (b.priority || 0) - (a.priority || 0) || a.name.localeCompare(b.name));
  }
  moveLanguage(id, dir) {
    const ids = this.languages.map((l) => l.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length)
      return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    this.settings.languageOrder = ids;
    this.sortLanguages();
  }
  refreshActiveLanguages() {
    const enabled = new Set(this.settings.enabledLanguages || []);
    this.activeLanguages = this.languages.filter((l) => enabled.has(l.id));
    this.keysCache = /* @__PURE__ */ new Map();
  }
  async updateStatusBar() {
    const el = this.statusBarEl;
    if (!el)
      return;
    const clear = () => {
      el.setText("");
      el.removeAttribute("aria-label");
    };
    if (!this.settings.statusBar)
      return clear();
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md" || !this.inScope(file.path))
      return clear();
    try {
      const text = await this.app.vault.cachedRead(file);
      const canon = new Set(this.findMatches(text, this.canonicalForPath(file.path), { protect: true }).map((m) => m.canonical));
      if (this.settings.statusBarIncludeLinks) {
        const cache = this.app.metadataCache.getFileCache(file);
        for (const link of cache && cache.links || []) {
          const dest = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
          if (dest && this.isGlossaryFile(dest))
            canon.add(dest.basename);
        }
      }
      const n = canon.size;
      el.setText(plural("term", n));
      el.setAttribute("aria-label", t("statusBar.aria", { n }));
    } catch (e) {
      clear();
    }
  }
  isGlossaryPath(path) {
    const p = this.settings.glossaryFolder.replace(/\/+$/, "");
    if (!p)
      return true;
    return path === `${p}.md` || path.startsWith(`${p}/`);
  }
  isGlossaryFile(file) {
    return file && file.extension === "md" && this.isGlossaryPath(file.path);
  }
  async ensureGlossaryFolder() {
    const path = this.settings.glossaryFolder.replace(/\/+$/, "");
    if (!path || this.app.vault.getAbstractFileByPath(path))
      return;
    try {
      await this.app.vault.createFolder(path);
    } catch (e) {
    }
  }
  canonicalForPath(path) {
    if (!path || !this.isGlossaryPath(path))
      return null;
    const base = path.split("/").pop();
    return base.replace(/\.md$/, "");
  }
  // Parse the inside of a [[...]] into { target, display, hasSubpath }. Mirrors the
  // table-escape (\| separator) and #subpath handling so every link-reading path agrees.
  parseWikiInner(inner) {
    const pipe = inner.indexOf("|");
    const rawTarget = (pipe >= 0 ? inner.slice(0, pipe) : inner).replace(/\\$/, "").trim();
    const hasSubpath = rawTarget.includes("#");
    const target = rawTarget.replace(/#.*$/, "").trim();
    const display = (pipe >= 0 ? inner.slice(pipe + 1) : target).trim();
    return { target, display, hasSubpath };
  }
  // The wikilink the cursor or selection touches if it points to a glossary term, else null.
  // Spanning the selection (not just a point) is what catches a link in a table cell, where a
  // right-click selects the cell text instead of placing a bare cursor.
  glossaryLinkAt(editor) {
    const head = editor.getCursor("head");
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const lineNo = head.line;
    const line = editor.getLine(lineNo);
    const selStart = from.line === lineNo ? from.ch : 0;
    const selEnd = to.line === lineNo ? to.ch : line.length;
    const re = /\[\[([^\]\n]+)\]\]/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const s = m.index;
      const e = m.index + m[0].length;
      if (selEnd < s || selStart > e)
        continue;
      const { target, display } = this.parseWikiInner(m[1]);
      if (!target)
        continue;
      const sourcePath = this.app.workspace.getActiveFile() ? this.app.workspace.getActiveFile().path : "";
      const dest = this.app.metadataCache.getFirstLinkpathDest(target, sourcePath);
      if (dest && this.isGlossaryFile(dest))
        return { canonical: dest.basename, display, targetFile: dest, line: lineNo, from: s, to: e };
    }
    return null;
  }
  aliasesOf(file) {
    const fm = this.app.metadataCache.getFileCache(file);
    const a = fm && fm.frontmatter && fm.frontmatter.aliases;
    if (Array.isArray(a))
      return a.filter((x) => typeof x === "string" && x.trim());
    if (typeof a === "string" && a.trim())
      return [a];
    return [];
  }
  activeCanonical() {
    const f = this.app.workspace.getActiveFile();
    return f ? this.canonicalForPath(f.path) : null;
  }
  wikiLink(canonical, display, inTable) {
    if (display === canonical)
      return `[[${canonical}]]`;
    return inTable ? `[[${canonical}\\|${display}]]` : `[[${canonical}|${display}]]`;
  }
  // Replace each match (sorted, non-overlapping) with a wikilink, right to left.
  applyLinks(text, matches) {
    const sorted = matches.slice().sort((a, b) => a.start - b.start);
    const links = sorted.map((m) => this.wikiLink(m.canonical, m.display, inTableCell(text, m.start)));
    let out = text;
    for (let j = sorted.length - 1; j >= 0; j--) {
      out = out.slice(0, sorted[j].start) + links[j] + out.slice(sorted[j].end);
    }
    const changes = sorted.map((m, j) => ({ start: m.start, before: m.display, after: links[j] }));
    return { newText: out, changes };
  }
  // Inverse of applyLinks: replace each glossary link span with its plain display text,
  // right to left. The display has no pipe, so a table cell survives without escaping.
  unlinkLinks(text, links) {
    const sorted = links.slice().sort((a, b) => a.start - b.start);
    let out = text;
    for (let j = sorted.length - 1; j >= 0; j--) {
      out = out.slice(0, sorted[j].start) + sorted[j].display + out.slice(sorted[j].end);
    }
    return { newText: out, count: sorted.length };
  }
  // Unlink the single glossary link under the cursor (from glossaryLinkAt).
  unlinkLinkAt(editor, link) {
    editor.replaceRange(link.display, { line: link.line, ch: link.from }, { line: link.line, ch: link.to });
    new Notice(t("notice.unlinked"));
    this.updateStatusBar();
  }
  openTerm(canonical, sourcePath, newTab) {
    this.app.workspace.openLinkText(canonical, sourcePath || "", newTab);
  }
  activePath() {
    const f = this.app.workspace.getActiveFile();
    return f ? f.path : "";
  }
  // `hoverParent` decides how long the preview lives: normally the plugin, but the duplicate
  // list passes its own component so the preview it opens dies with the list.
  hoverTerm(event, targetEl, canonical, sourcePath, hoverParent) {
    this.app.workspace.trigger("hover-link", {
      event,
      source: hoverParent ? "glossary-linker-choice" : "glossary-linker",
      hoverParent: hoverParent || this,
      targetEl,
      linktext: canonical,
      sourcePath: sourcePath || ""
    });
  }
  inScope(path) {
    const covers = (entry) => {
      const e = sanitizeFolder(entry);
      return !!e && (path === e || path.startsWith(e + "/"));
    };
    if (splitLines(this.settings.excludeFolders).some(covers))
      return false;
    if (this.settings.scopeMode === "folders")
      return splitLines(this.settings.scopeFolders).some(covers);
    return true;
  }
  getScopeFiles() {
    return this.app.vault.getMarkdownFiles().filter((f) => this.inScope(f.path));
  }
  pathListed(listKey, path) {
    const entry = sanitizeFolder(path);
    return !!entry && splitLines(this.settings[listKey]).some((l) => sanitizeFolder(l) === entry);
  }
  // Scope only affects which notes get linked, so a rerender — not a rebuild — is enough.
  async setPathInList(listKey, path, add) {
    const entry = sanitizeFolder(path);
    if (!entry || add === this.pathListed(listKey, path))
      return;
    const lines = splitLines(this.settings[listKey]);
    this.settings[listKey] = (add ? [...lines, entry] : lines.filter((l) => sanitizeFolder(l) !== entry)).join("\n");
    await this.saveSettings();
    this.rerenderViews();
    this.updateStatusBar();
    this.refreshOverviewDebounced();
    const key = listKey === "excludeFolders" ? add ? "notice.pathAddedExcluded" : "notice.pathRemovedExcluded" : add ? "notice.pathAddedScope" : "notice.pathRemovedScope";
    new Notice(t(key, { entry }));
  }
  rerenderViews() {
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      const v = leaf.view;
      if (v && v.previewMode && typeof v.previewMode.rerender === "function")
        v.previewMode.rerender(true);
    });
    this.refreshEditors();
  }
  refreshEditors() {
    if (!this.cmRefreshEffect)
      return;
    this.app.workspace.getLeavesOfType("markdown").forEach((leaf) => {
      const cm = leaf.view && leaf.view.editor && leaf.view.editor.cm;
      if (cm)
        cm.dispatch({ effects: this.cmRefreshEffect.of(null) });
    });
  }
  async activateOverview() {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(OVERVIEW_VIEW_TYPE)[0];
    if (!leaf) {
      leaf = workspace.getRightLeaf(false);
      if (!leaf)
        return;
      await leaf.setViewState({ type: OVERVIEW_VIEW_TYPE, active: true });
    }
    workspace.revealLeaf(leaf);
  }
  refreshOverview() {
    this.app.workspace.getLeavesOfType(OVERVIEW_VIEW_TYPE).forEach((leaf) => {
      if (leaf.view && typeof leaf.view.refresh === "function")
        leaf.view.refresh();
    });
  }
  applyRibbonIcon() {
    const want = this.settings.showRibbonIcon;
    if (want && !this.ribbonEl) {
      this.ribbonEl = this.addRibbonIcon("book-a", t("ribbon.tooltip"), () => this.activateOverview());
    } else if (!want && this.ribbonEl) {
      this.ribbonEl.remove();
      this.ribbonEl = null;
    }
  }
};
Object.assign(GlossaryLinkerPlugin.prototype, matcher, highlight, actions, api, indexEvents);
module.exports = GlossaryLinkerPlugin;
