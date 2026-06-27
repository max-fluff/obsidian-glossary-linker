/* Glossary Linker — bundled from src/ by esbuild. Do not edit directly; edit src/ and run "npm run build". */
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
      scopeMode: "folders",
      // 'folders' | 'except' | 'vault'
      scopeFolders: "design\narchitecture\nfeatures\nguides\nvision",
      excludeFolders: "_meta\n_attachments\n.obsidian",
      matchMode: "stemmer",
      // 'stemmer' | 'endingStrip' | 'exact'
      enabledLanguages: null,
      // null = enable everything discovered on first run
      aliasHarvestMode: "lemma",
      // 'lemma' | 'literal' | 'both'
      harvestOnSave: "off",
      // 'off' | 'silent' | 'preview'
      harvestSingleWordOnly: true,
      harvestMinLength: 2,
      excludeTerms: "",
      excludeWords: "",
      linkFirstOnly: false,
      highlightInReading: true,
      editingHighlight: "live",
      // 'off' | 'live' | 'onSave'
      skipHeadings: true
    };
    var splitLines2 = (s) => (s || "").split("\n").map((x) => x.trim()).filter(Boolean);
    module2.exports = { DEFAULT_SETTINGS: DEFAULT_SETTINGS2, splitLines: splitLines2 };
  }
});

// languages/ru.js
var require_ru = __commonJS({
  "languages/ru.js"(exports2, module2) {
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
    function lemma(word) {
      word = word.toLowerCase().replace(/ё/g, "\u0435");
      if (word.length > 3 && (word.endsWith("\u0435\u043C") || word.endsWith("\u0451\u043C"))) {
        const before = word[word.length - 3];
        if (VOWELS.includes(before))
          return word.slice(0, -2) + "\u0439";
      }
      return strip(word);
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
        if (mode === "endingStrip")
          return [strip(w)];
        return stemKeys(w);
      },
      lemma
    };
  }
});

// languages/en.js
var require_en = __commonJS({
  "languages/en.js"(exports2, module2) {
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

// languages/es.js
var require_es = __commonJS({
  "languages/es.js"(exports2, module2) {
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

// languages/de.js
var require_de = __commonJS({
  "languages/de.js"(exports2, module2) {
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

// languages/fr.js
var require_fr = __commonJS({
  "languages/fr.js"(exports2, module2) {
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

// src/builtin-languages.js
var require_builtin_languages = __commonJS({
  "src/builtin-languages.js"(exports2, module2) {
    "use strict";
    module2.exports = [
      require_ru(),
      require_en(),
      require_es(),
      require_de(),
      require_fr()
    ];
  }
});

// src/settings-tab.js
var require_settings_tab = __commonJS({
  "src/settings-tab.js"(exports2, module2) {
    "use strict";
    var { PluginSettingTab, Setting, Notice: Notice2 } = require("obsidian");
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
          if (rebuild)
            this.plugin.rebuildIndex();
        };
        containerEl.createEl("h3", { text: "Scope" });
        new Setting(containerEl).setName("Glossary folder").setDesc(`Folder with one note per term (file name = term title). Both this folder's notes and their frontmatter "aliases" build the term index. Path is relative to the vault root.`).addText((t) => t.setValue(s.glossaryFolder).onChange(async (v) => {
          s.glossaryFolder = v.trim();
          await save(true);
        }));
        new Setting(containerEl).setName("Link scope").setDesc('Which notes the plugin highlights terms in and turns them into links. "Listed folders only" restricts to the folders below; "Everywhere except listed" covers the vault but skips the folders below; "Everywhere" covers the whole vault. The always-excluded folders below are removed on top of all three.').addDropdown((d) => d.addOption("folders", "Listed folders only").addOption("except", "Everywhere except listed").addOption("vault", "Everywhere").setValue(s.scopeMode).onChange(async (v) => {
          s.scopeMode = v;
          await save(false);
          this.display();
        }));
        if (s.scopeMode !== "vault") {
          new Setting(containerEl).setName(s.scopeMode === "except" ? "Folders to exclude" : "Folders to include").setDesc(s.scopeMode === "except" ? "One folder path per line. These folders are skipped; everything else is in scope." : "One folder path per line. Only notes inside these folders are in scope.").addTextArea((t) => {
            t.setValue(s.scopeFolders).onChange(async (v) => {
              s.scopeFolders = v;
              await save(false);
            });
            t.inputEl.rows = 5;
          });
        }
        new Setting(containerEl).setName("Always-excluded folders").setDesc("One folder path per line. Never highlighted, linked or scanned, whatever the mode above is. A good place for the .obsidian config folder and attachment folders.").addTextArea((t) => {
          t.setValue(s.excludeFolders).onChange(async (v) => {
            s.excludeFolders = v;
            await save(false);
          });
          t.inputEl.rows = 3;
        });
        containerEl.createEl("h3", { text: "Matching" });
        new Setting(containerEl).setName("Morphology").setDesc(`How an inflected word in the text is matched to a term. The actual algorithm comes from the enabled language modules below, picked automatically by the word's script. "Stemmer" reduces words to their root (handles declensions and plurals like units \u2192 unit) and is recommended. "Ending strip" only chops common endings (lighter, fewer matches). "Exact match" requires the exact term/alias spelling.`).addDropdown((d) => d.addOption("stemmer", "Stemmer (recommended)").addOption("endingStrip", "Ending strip").addOption("exact", "Exact match").setValue(s.matchMode).onChange(async (v) => {
          s.matchMode = v;
          await save(true);
        }));
        const langs = this.plugin.languages;
        const errors = this.plugin.languageErrors || [];
        const enabledCount = langs.filter((l) => (s.enabledLanguages || []).includes(l.id)).length;
        if (this.showLanguages === void 0)
          this.showLanguages = false;
        const langDesc = `Morphology modules in the "languages" folder \u2014 ${enabledCount} of ${langs.length} enabled` + (errors.length ? `, ${errors.length} with errors` : "") + ". Disabled languages are matched exactly (no inflection).";
        new Setting(containerEl).setName("Languages").setDesc(langDesc).addExtraButton((b) => b.setIcon("refresh-cw").setTooltip("Reload \u2014 re-scan the languages folder").onClick(async () => {
          await this.plugin.loadLanguages();
          this.plugin.rebuildIndex();
          this.display();
        })).addExtraButton((b) => b.setIcon(this.showLanguages ? "chevron-up" : "chevron-down").setTooltip(this.showLanguages ? "Hide languages" : "Show languages").onClick(() => {
          this.showLanguages = !this.showLanguages;
          this.display();
        }));
        if (!langs.length && !errors.length) {
          containerEl.createEl("div", { cls: "glossary-preview-empty", text: "No language modules found." });
        }
        if (this.showLanguages) {
          for (const lang of langs) {
            const row = new Setting(containerEl).setName(lang.name).setDesc(`id: ${lang.id}`).addToggle((t) => t.setValue((s.enabledLanguages || []).includes(lang.id)).onChange(async (v) => {
              const set = new Set(s.enabledLanguages || []);
              if (v)
                set.add(lang.id);
              else
                set.delete(lang.id);
              s.enabledLanguages = [...set];
              await this.plugin.saveSettings();
              this.plugin.refreshActiveLanguages();
              this.plugin.rebuildIndex();
              this.plugin.rerenderViews();
              this.display();
            }));
            row.settingEl.addClass("glossary-lang-row");
          }
          for (const bad of errors) {
            const row = new Setting(containerEl).setName(bad.file).setDesc(`Invalid module: ${bad.error}`).addExtraButton((b) => b.setIcon("alert-triangle").setTooltip(`Invalid module: ${bad.error}`).setDisabled(true));
            row.nameEl.addClass("glossary-lang-error");
            row.settingEl.addClass("glossary-lang-row");
            row.settingEl.addClass("mod-warning");
          }
        }
        new Setting(containerEl).setName("Link first occurrence only").setDesc("When turning terms into links, link only the first occurrence of each term on a page and leave the rest as plain text. Off = link every occurrence.").addToggle((t) => t.setValue(s.linkFirstOnly).onChange(async (v) => {
          s.linkFirstOnly = v;
          await save(false);
        }));
        new Setting(containerEl).setName("Excluded terms").setDesc("Term titles, one per line. These glossary terms are dropped from the index entirely \u2014 never highlighted or linked anywhere.").addTextArea((t) => {
          t.setValue(s.excludeTerms).onChange(async (v) => {
            s.excludeTerms = v;
            await save(true);
          });
          t.inputEl.rows = 3;
        });
        new Setting(containerEl).setName("Excluded words").setDesc('Surface words, one per line. These words (and their inflections) never trigger a link, even if they match a term \u2014 useful for homonyms (e.g. a common word "lead" that collides with a term "Lead").').addTextArea((t) => {
          t.setValue(s.excludeWords).onChange(async (v) => {
            s.excludeWords = v;
            await save(true);
          });
          t.inputEl.rows = 3;
        });
        containerEl.createEl("h3", { text: "Highlighting" });
        new Setting(containerEl).setName("Highlight in Reading view").setDesc("In the fully-rendered Reading view, underline detected terms as clickable links (the note text on disk is not changed). They behave like real internal links: hover shows a page preview (per your Page Preview settings), click opens the note, right-click opens the actions menu.").addToggle((t) => t.setValue(s.highlightInReading).onChange(async (v) => {
          s.highlightInReading = v;
          await save(false);
          this.plugin.rerenderViews();
        }));
        new Setting(containerEl).setName("Highlight while editing").setDesc('Underline terms in the editor (Live Preview / Source view) too, not just in Reading view. "Live" updates as you type; "On save" updates a moment after you stop typing (less flicker); "Off" leaves the editor unhighlighted. Takes effect immediately, no reload needed.').addDropdown((d) => d.addOption("off", "Off").addOption("live", "Live (as you type)").addOption("onSave", "On save").setValue(s.editingHighlight).onChange(async (v) => {
          s.editingHighlight = v;
          await save(false);
          this.plugin.refreshEditors();
        }));
        new Setting(containerEl).setName("Skip headings").setDesc("Do not highlight or turn into links any terms that appear inside Markdown headings (lines starting with #). On = headings are left untouched.").addToggle((t) => t.setValue(s.skipHeadings).onChange(async (v) => {
          s.skipHeadings = v;
          await save(false);
          this.plugin.rerenderViews();
        }));
        containerEl.createEl("h3", { text: "Collecting aliases" });
        containerEl.createEl("div", { cls: "glossary-section-desc", text: "Reads the links you already made by hand, like [[Term|some wording]], and adds that wording to the term's aliases \u2014 so the same wording links automatically next time." });
        new Setting(containerEl).setName("Alias form").setDesc('How the link text is stored as an alias. "Base form" reduces it to a dictionary form first, so one alias covers many word forms (link text "boxes" is stored as "box"). "As written" stores the exact text ("boxes"). "Both" stores both.').addDropdown((d) => d.addOption("lemma", "Base form").addOption("literal", "As written").addOption("both", "Both").setValue(s.aliasHarvestMode).onChange(async (v) => {
          s.aliasHarvestMode = v;
          await save(false);
        }));
        new Setting(containerEl).setName("Collect on save").setDesc('Collect aliases automatically when a note is saved (with a short delay). "Silent" adds new aliases without asking; "Ask first" shows a preview to confirm; "Off" = only via the commands.').addDropdown((d) => d.addOption("off", "Off").addOption("silent", "Silent (add automatically)").addOption("preview", "Ask first").setValue(s.harvestOnSave).onChange(async (v) => {
          s.harvestOnSave = v;
          await save(false);
        }));
        new Setting(containerEl).setName("Single-word aliases only").setDesc("Only collect link texts that are a single word. On = skip multi-word link text, which reduces to a base form poorly. Off = also collect multi-word texts as written.").addToggle((t) => t.setValue(s.harvestSingleWordOnly).onChange(async (v) => {
          s.harvestSingleWordOnly = v;
          await save(false);
        }));
        new Setting(containerEl).setName("Minimum alias length").setDesc("Ignore collected aliases shorter than this many characters (avoids noise from 1\u20132 letter fragments).").addText((t) => {
          t.inputEl.type = "number";
          t.inputEl.min = "1";
          t.setValue(String(s.harvestMinLength)).onChange(async (v) => {
            const n = parseInt(v, 10);
            s.harvestMinLength = Number.isFinite(n) && n > 0 ? n : 1;
            await save(false);
          });
        });
        containerEl.createEl("h3", { text: "Maintenance" });
        new Setting(containerEl).setName("Rebuild glossary index").setDesc("Re-scan the glossary folder now. The index also rebuilds automatically when glossary notes change.").addButton((b) => b.setButtonText("Rebuild").onClick(() => {
          this.plugin.rebuildIndex();
          new Notice2("Glossary Linker: index rebuilt");
        }));
      }
    };
    module2.exports = { GlossaryLinkerSettingTab: GlossaryLinkerSettingTab2 };
  }
});

// src/matcher.js
var require_matcher = __commonJS({
  "src/matcher.js"(exports2, module2) {
    "use strict";
    var { splitLines: splitLines2 } = require_constants();
    module2.exports = {
      // Match keys for a word: the union of keys from every enabled language that
      // claims it (same-script languages overlap, e.g. en/es/de/fr on Latin).
      // Unknown scripts fall back to the lowercased exact form.
      keysFor(word) {
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
          out.push(word.toLowerCase());
        return out;
      },
      // Base form for collected aliases: the first claiming language wins (by priority).
      lemmaFor(word) {
        for (const lang of this.activeLanguages) {
          if (lang.match(word))
            return lang.lemma ? lang.lemma(word) : word.toLowerCase();
        }
        return word.toLowerCase();
      },
      tokenizeForm(form) {
        const words = [...form.matchAll(/[\p{L}\p{Nd}]+/gu)].map((m) => m[0]);
        return words.map((raw) => ({ raw, lower: raw.toLowerCase(), keys: this.keysFor(raw) }));
      },
      rebuildIndex() {
        const byKey = /* @__PURE__ */ new Map();
        const excludeTerms = new Set(splitLines2(this.settings.excludeTerms).map((s) => s.toLowerCase()));
        this.excludeWordKeys = /* @__PURE__ */ new Set();
        for (const w of splitLines2(this.settings.excludeWords)) {
          for (const k of this.keysFor(w))
            this.excludeWordKeys.add(k);
        }
        const files = this.app.vault.getMarkdownFiles().filter((f) => this.isGlossaryFile(f));
        for (const file of files) {
          const canonical = file.basename;
          if (excludeTerms.has(canonical.toLowerCase()))
            continue;
          const forms = [canonical, ...this.aliasesOf(file)].filter((x) => typeof x === "string" && x.trim());
          const target = { canonical, path: file.path };
          for (const form of forms) {
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
        this.index = { byKey };
      },
      findMatches(text, currentCanonical, opts = {}) {
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
          let matched = null;
          if (cands.length) {
            const sorted = cands.length > 1 ? cands.slice().sort((a, b) => b.wordCount - a.wordCount) : cands;
            for (const c of sorted) {
              const wc = c.wordCount;
              if (i + wc > tokens.length)
                continue;
              let ok = true;
              for (let k = 0; k < wc; k++) {
                const t2 = tokens[i + k];
                const w = c.words[k];
                if (k > 0) {
                  const between = text.slice(tokens[i + k - 1].end, t2.start);
                  if (/[^\s-]/.test(between)) {
                    ok = false;
                    break;
                  }
                }
                const t2keys = k === 0 ? t2.keys : this.keysFor(t2.raw);
                if (!t2keys.some((kk) => w.keys.includes(kk))) {
                  ok = false;
                  break;
                }
              }
              if (ok) {
                matched = { c, start: tokens[i].start, end: tokens[i + wc - 1].end, wc };
                break;
              }
            }
          }
          if (matched && matched.c.canonical !== currentCanonical) {
            const oneWordExcluded = matched.wc === 1 && tk.keys.some((k) => this.excludeWordKeys.has(k));
            const inProtected = protect && this.overlapsProtected(protect, matched.start, matched.end);
            if (!oneWordExcluded && !inProtected) {
              results.push({
                start: matched.start,
                end: matched.end,
                canonical: matched.c.canonical,
                display: text.slice(matched.start, matched.end)
              });
              i += matched.wc;
              continue;
            }
          }
          i++;
        }
        return results;
      },
      // Ranges in raw markdown that must not be linked: frontmatter, code, links, urls, headings.
      computeProtected(text) {
        const ranges = [];
        const push = (re) => {
          let m;
          while ((m = re.exec(text)) !== null)
            ranges.push([m.index, m.index + m[0].length]);
        };
        if (/^---\r?\n/.test(text)) {
          const end = text.indexOf("\n---", 3);
          if (end !== -1)
            ranges.push([0, end + 4]);
        }
        push(/```[\s\S]*?```/g);
        push(/~~~[\s\S]*?~~~/g);
        push(/`[^`\n]+`/g);
        push(/\[\[[^\]]*\]\]/g);
        push(/\[[^\]]*\]\([^)]*\)/g);
        push(/(?:https?:\/\/|www\.)\S+/g);
        if (this.settings.skipHeadings)
          push(/^[ \t]*#{1,6}[ \t].*$/gm);
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
      }
    };
  }
});

// src/highlight.js
var require_highlight = __commonJS({
  "src/highlight.js"(exports2, module2) {
    "use strict";
    module2.exports = {
      processReadingMode(el, ctx) {
        if (!this.settings.highlightInReading)
          return;
        const sourcePath = ctx.sourcePath;
        const currentCanonical = this.canonicalForPath(sourcePath);
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
          acceptNode: (node) => {
            let p = node.parentElement;
            while (p) {
              const tag = p.tagName;
              if (tag === "CODE" || tag === "PRE" || tag === "A")
                return NodeFilter.FILTER_REJECT;
              if (this.settings.skipHeadings && /^H[1-6]$/.test(tag))
                return NodeFilter.FILTER_REJECT;
              if (p.classList && p.classList.contains("glossary-link"))
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
          this.decorateTextNode(node, currentCanonical, sourcePath);
      },
      decorateTextNode(node, currentCanonical, sourcePath) {
        const text = node.textContent;
        if (!text || text.length < 2)
          return;
        const matches = this.findMatches(text, currentCanonical);
        if (!matches.length)
          return;
        const frag = document.createDocumentFragment();
        let cursor = 0;
        for (const m of matches) {
          if (m.start > cursor)
            frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
          const canonical = m.canonical;
          const display = m.display;
          const a = document.createElement("a");
          a.className = "internal-link glossary-link";
          a.textContent = display;
          a.href = canonical;
          a.setAttribute("data-href", canonical);
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener nofollow");
          a.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = sourcePath ? this.app.vault.getAbstractFileByPath(sourcePath) : null;
            this.showLinkMenu(e, canonical, display, file, null);
          });
          frag.appendChild(a);
          cursor = m.end;
        }
        if (cursor < text.length)
          frag.appendChild(document.createTextNode(text.slice(cursor)));
        node.parentNode.replaceChild(frag, node);
      },
      // Highlight in the editor (Live Preview / Source). Always registered; the
      // editingHighlight setting controls whether and how often it recomputes.
      registerEditingHighlight() {
        let view, state, language;
        try {
          view = require("@codemirror/view");
          state = require("@codemirror/state");
          language = require("@codemirror/language");
        } catch (e) {
          console.warn("Glossary Linker: CM6 modules unavailable, editor highlight disabled", e);
          return;
        }
        const { ViewPlugin, Decoration } = view;
        const { RangeSetBuilder, StateEffect } = state;
        const { syntaxTree } = language;
        const plugin = this;
        const refresh = StateEffect.define();
        this.cmRefreshEffect = refresh;
        const markCache = /* @__PURE__ */ new Map();
        const markFor = (canonical) => {
          let m = markCache.get(canonical);
          if (!m) {
            m = Decoration.mark({ class: "cm-glossary-link", attributes: { "data-glossary-target": canonical } });
            markCache.set(canonical, m);
          }
          return m;
        };
        const skipNode = (name) => /code|link|url|header|hashtag|frontmatter|comment|tag|escape/i.test(name);
        const buildDeco = (editorView) => {
          const builder = new RangeSetBuilder();
          const currentCanonical = plugin.activeCanonical();
          const tree = syntaxTree(editorView.state);
          for (const { from, to } of editorView.visibleRanges) {
            const text = editorView.state.doc.sliceString(from, to);
            for (const m of plugin.findMatches(text, currentCanonical)) {
              const start = from + m.start;
              const end = from + m.end;
              let skip = false;
              tree.iterate({ from: start, to: end, enter: (n) => {
                if (skipNode(n.type.name))
                  skip = true;
              } });
              if (!skip)
                builder.add(start, end, markFor(m.canonical));
            }
          }
          return builder.finish();
        };
        const targetEl = (e) => e.target instanceof HTMLElement ? e.target.closest(".cm-glossary-link") : null;
        const canonicalOf = (el) => el.getAttribute("data-glossary-target");
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
                if (!el || e.button !== 0)
                  return;
                const file = plugin.app.workspace.getActiveFile();
                plugin.openTerm(canonicalOf(el), file ? file.path : "", e.ctrlKey || e.metaKey);
                e.preventDefault();
              },
              mouseover(e) {
                const el = targetEl(e);
                if (!el)
                  return;
                const file = plugin.app.workspace.getActiveFile();
                plugin.hoverTerm(e, el, canonicalOf(el), file ? file.path : "");
              },
              contextmenu(e, view2) {
                const el = targetEl(e);
                if (!el)
                  return;
                const pos = view2.posAtCoords({ x: e.clientX, y: e.clientY });
                if (pos == null)
                  return;
                const file = plugin.app.workspace.getActiveFile();
                const match = plugin.findMatches(view2.state.doc.toString(), plugin.activeCanonical(), { protect: true }).find((m) => pos >= m.start && pos < m.end);
                if (!match)
                  return;
                e.preventDefault();
                plugin.showLinkMenu(e, match.canonical, match.display, file, match.start);
              }
            }
          }
        );
        this.registerEditorExtension(vp);
      }
    };
  }
});

// src/modals.js
var require_modals = __commonJS({
  "src/modals.js"(exports2, module2) {
    "use strict";
    var { Modal } = require("obsidian");
    var MaterializePreviewModal = class extends Modal {
      constructor(app, fileChanges, onApply) {
        super(app);
        this.fileChanges = fileChanges;
        this.onApply = onApply;
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "Turn terms into links \u2014 preview" });
        const total = this.fileChanges.reduce((n, f) => n + f.changes.length, 0);
        contentEl.createEl("p", { text: `Files: ${this.fileChanges.length}, replacements: ${total}` });
        for (const fc of this.fileChanges) {
          contentEl.createDiv({ cls: "glossary-preview-file", text: fc.file ? fc.file.path : fc.label || "selection" });
          const table = contentEl.createEl("table", { cls: "glossary-preview-table" });
          for (const c of fc.changes.slice(0, 50)) {
            const tr = table.createEl("tr");
            tr.createEl("td", { text: c.before });
            tr.createEl("td", { text: "\u2192" });
            tr.createEl("td", { text: c.after });
          }
          if (fc.changes.length > 50)
            contentEl.createEl("div", { cls: "glossary-preview-empty", text: `\u2026and ${fc.changes.length - 50} more` });
        }
        const buttons = contentEl.createDiv({ cls: "glossary-preview-buttons" });
        const apply = buttons.createEl("button", { text: "Apply", cls: "mod-cta" });
        apply.onclick = async () => {
          await this.onApply(this.fileChanges);
          this.close();
        };
        buttons.createEl("button", { text: "Cancel" }).onclick = () => this.close();
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
      }
      onOpen() {
        const { contentEl } = this;
        contentEl.createEl("h3", { text: "Collect aliases \u2014 preview" });
        const total = this.additions.reduce((n, a) => n + a.aliases.length, 0);
        contentEl.createEl("p", { text: `Terms: ${this.additions.length}, new aliases: ${total}` });
        const table = contentEl.createEl("table", { cls: "glossary-preview-table" });
        const head = table.createEl("tr");
        head.createEl("th", { text: "Term" });
        head.createEl("th", { text: "Aliases to add" });
        for (const a of this.additions) {
          const tr = table.createEl("tr");
          tr.createEl("td", { text: a.file.basename });
          const td = tr.createEl("td");
          a.aliases.forEach((al, i) => {
            if (i)
              td.appendText(", ");
            td.createSpan({ cls: "glossary-add", text: al });
          });
        }
        const buttons = contentEl.createDiv({ cls: "glossary-preview-buttons" });
        const apply = buttons.createEl("button", { text: "Write", cls: "mod-cta" });
        apply.onclick = async () => {
          await this.onApply(this.additions);
          this.close();
        };
        buttons.createEl("button", { text: "Cancel" }).onclick = () => this.close();
      }
      onClose() {
        this.contentEl.empty();
      }
    };
    module2.exports = { MaterializePreviewModal, HarvestPreviewModal };
  }
});

// src/actions.js
var require_actions = __commonJS({
  "src/actions.js"(exports2, module2) {
    "use strict";
    var { Menu, Notice: Notice2 } = require("obsidian");
    var { MaterializePreviewModal, HarvestPreviewModal } = require_modals();
    module2.exports = {
      buildMaterialization(text, currentCanonical) {
        const matches = this.findMatches(text, currentCanonical, { protect: true });
        const seen = /* @__PURE__ */ new Set();
        const chosen = [];
        for (const m of matches) {
          if (this.settings.linkFirstOnly && seen.has(m.canonical))
            continue;
          seen.add(m.canonical);
          chosen.push(m);
        }
        return this.applyLinks(text, chosen);
      },
      async materializeCurrent() {
        const file = this.app.workspace.getActiveFile();
        if (!file) {
          new Notice2("No active note");
          return;
        }
        const text = await this.app.vault.read(file);
        const { newText, changes } = this.buildMaterialization(text, this.canonicalForPath(file.path));
        if (!changes.length) {
          new Notice2("Glossary Linker: no matches found");
          return;
        }
        new MaterializePreviewModal(this.app, [{ file, newText, changes }], async (files) => {
          for (const f of files)
            await this.app.vault.modify(f.file, f.newText);
          new Notice2(`Glossary Linker: ${changes.length} link(s) created`);
        }).open();
      },
      materializeSelection(editor) {
        const sel = editor.getSelection();
        if (!sel) {
          new Notice2("No selection");
          return;
        }
        const file = this.app.workspace.getActiveFile();
        const { newText, changes } = this.buildMaterialization(sel, file ? this.canonicalForPath(file.path) : null);
        if (!changes.length) {
          new Notice2("Glossary Linker: no matches found");
          return;
        }
        new MaterializePreviewModal(this.app, [{ file: null, newText, changes, label: "selection" }], () => {
          editor.replaceSelection(newText);
          new Notice2(`Glossary Linker: ${changes.length} link(s) created`);
        }).open();
      },
      async materializeScope() {
        const files = this.getScopeFiles();
        const fileChanges = [];
        for (const file of files) {
          const text = await this.app.vault.read(file);
          const { newText, changes } = this.buildMaterialization(text, this.canonicalForPath(file.path));
          if (changes.length)
            fileChanges.push({ file, newText, changes });
        }
        if (!fileChanges.length) {
          new Notice2("Glossary Linker: no matches found");
          return;
        }
        new MaterializePreviewModal(this.app, fileChanges, async (selected) => {
          let total = 0;
          for (const f of selected) {
            await this.app.vault.modify(f.file, f.newText);
            total += f.changes.length;
          }
          new Notice2(`Glossary Linker: ${selected.length} file(s), ${total} link(s)`);
        }).open();
      },
      showLinkMenu(evt, canonical, display, file, nearOffset) {
        const menu = new Menu();
        if (file) {
          menu.addItem((i) => i.setTitle("Turn into link").setIcon("link").onClick(() => this.materializeSingle(file, canonical, display, nearOffset)));
          menu.addItem((i) => i.setTitle(`Turn all "${canonical}" into links`).setIcon("links-coming-in").onClick(() => this.materializeTerm(file, canonical)));
          menu.addSeparator();
        }
        const sourcePath = file ? file.path : "";
        menu.addItem((i) => i.setTitle("Open glossary note").setIcon("file-text").onClick(() => this.openTerm(canonical, sourcePath, false)));
        menu.addItem((i) => i.setTitle("Open in new tab").setIcon("file-plus").onClick(() => this.openTerm(canonical, sourcePath, true)));
        menu.showAtMouseEvent(evt);
      },
      async materializeSingle(file, canonical, display, nearOffset) {
        const text = await this.app.vault.read(file);
        const matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true }).filter((m) => m.canonical === canonical && m.display === display);
        if (!matches.length) {
          new Notice2("Glossary Linker: occurrence not found");
          return;
        }
        let target = matches[0];
        if (nearOffset != null) {
          target = matches.reduce((best, m) => Math.abs(m.start - nearOffset) < Math.abs(best.start - nearOffset) ? m : best, matches[0]);
        }
        const { newText } = this.applyLinks(text, [target]);
        await this.app.vault.modify(file, newText);
        new Notice2("Glossary Linker: link created");
      },
      async materializeTerm(file, canonical) {
        const text = await this.app.vault.read(file);
        const matches = this.findMatches(text, this.canonicalForPath(file.path), { protect: true }).filter((m) => m.canonical === canonical);
        if (!matches.length) {
          new Notice2("Glossary Linker: no occurrences found");
          return;
        }
        const { newText } = this.applyLinks(text, matches);
        await this.app.vault.modify(file, newText);
        new Notice2(`Glossary Linker: ${matches.length} link(s) created`);
      },
      // Keys and literals of every existing form of a term (to skip what highlighting already matches).
      termFormKeys(file) {
        const forms = [file.basename, ...this.aliasesOf(file)].filter((x) => typeof x === "string" && x.trim());
        const keys = /* @__PURE__ */ new Set();
        const literals = /* @__PURE__ */ new Set();
        for (const form of forms) {
          literals.add(form.toLowerCase());
          const words = this.tokenizeForm(form);
          if (words.length === 1)
            for (const k of words[0].keys)
              keys.add(k);
        }
        return { keys, literals };
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
      async harvestFiles(files, silent) {
        const perTerm = /* @__PURE__ */ new Map();
        for (const file of files) {
          const cache = this.app.metadataCache.getFileCache(file);
          if (!cache || !cache.links)
            continue;
          for (const link of cache.links) {
            const display = link.displayText;
            if (!display)
              continue;
            const targetFile = this.app.metadataCache.getFirstLinkpathDest(link.link, file.path);
            if (!targetFile || !this.isGlossaryFile(targetFile))
              continue;
            if (display.toLowerCase() === targetFile.basename.toLowerCase())
              continue;
            let entry = perTerm.get(targetFile.path);
            if (!entry) {
              entry = { file: targetFile, add: /* @__PURE__ */ new Map(), info: this.termFormKeys(targetFile) };
              perTerm.set(targetFile.path, entry);
            }
            for (const cand of this.harvestCandidates(display)) {
              if (entry.info.literals.has(cand))
                continue;
              if (entry.add.has(cand))
                continue;
              if (this.keysFor(cand).some((k) => entry.info.keys.has(k)))
                continue;
              entry.add.set(cand, { source: display });
            }
          }
        }
        const additions = [];
        for (const entry of perTerm.values()) {
          if (entry.add.size)
            additions.push({ file: entry.file, aliases: [...entry.add.keys()] });
        }
        if (!additions.length) {
          if (!silent)
            new Notice2("Glossary Linker: no new aliases found");
          return;
        }
        const apply = async (selected) => {
          await this.ensureGlossaryFolder();
          let total = 0;
          for (const a of selected) {
            await this.app.fileManager.processFrontMatter(a.file, (fm) => {
              let list = fm.aliases;
              if (!Array.isArray(list))
                list = typeof list === "string" && list.trim() ? [list] : [];
              const existing = new Set(list.map((x) => String(x).toLowerCase()));
              for (const al of a.aliases) {
                if (!existing.has(al.toLowerCase())) {
                  list.push(al);
                  existing.add(al.toLowerCase());
                  total++;
                }
              }
              fm.aliases = list;
            });
          }
          this.rebuildIndex();
          new Notice2(`Glossary Linker: ${total} alias(es) added`);
        };
        if (silent) {
          await apply(additions);
          return;
        }
        new HarvestPreviewModal(this.app, additions, apply).open();
      }
    };
  }
});

// src/main.js
var { Plugin, Notice, debounce } = require("obsidian");
var { DEFAULT_SETTINGS, splitLines } = require_constants();
var BUILTIN_LANGUAGES = require_builtin_languages();
var { GlossaryLinkerSettingTab } = require_settings_tab();
var matcher = require_matcher();
var highlight = require_highlight();
var actions = require_actions();
var GlossaryLinkerPlugin = class extends Plugin {
  async onload() {
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
    this.languages = [];
    this.activeLanguages = [];
    this.languageErrors = [];
    this.index = { byKey: /* @__PURE__ */ new Map() };
    this.excludeWordKeys = /* @__PURE__ */ new Set();
    await this.loadLanguages();
    this.rebuildIndex();
    this.scheduleRebuild = debounce(() => {
      this.rebuildIndex();
      this.rerenderViews();
    }, 600, true);
    this.app.workspace.onLayoutReady(() => this.rebuildIndex());
    this.registerEvent(this.app.metadataCache.on("changed", (file) => {
      if (this.isGlossaryPath(file.path))
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
    }));
    this.app.workspace.registerHoverLinkSource("glossary-linker", { display: "Glossary Linker", defaultMod: false });
    this.registerMarkdownPostProcessor((el, ctx) => this.processReadingMode(el, ctx));
    this.registerEditingHighlight();
    this.addCommand({
      id: "materialize-current",
      name: "Turn terms into links: this note",
      callback: () => this.materializeCurrent()
    });
    this.addCommand({
      id: "materialize-selection",
      name: "Turn terms into links: selection",
      editorCallback: (editor) => this.materializeSelection(editor)
    });
    this.addCommand({
      id: "materialize-scope",
      name: "Turn terms into links: all notes",
      callback: () => this.materializeScope()
    });
    this.addCommand({
      id: "harvest-current",
      name: "Collect aliases from links: this note",
      callback: () => {
        const f = this.app.workspace.getActiveFile();
        if (f)
          this.harvestFiles([f], false);
      }
    });
    this.addCommand({
      id: "harvest-scope",
      name: "Collect aliases from links: all notes",
      callback: () => this.harvestFiles(this.getScopeFiles(), false)
    });
    this.addCommand({
      id: "rebuild-index",
      name: "Rebuild glossary index",
      callback: () => {
        this.rebuildIndex();
        new Notice("Glossary Linker: index rebuilt");
      }
    });
    this.addSettingTab(new GlossaryLinkerSettingTab(this.app, this));
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  async loadLanguages() {
    this.languages = BUILTIN_LANGUAGES.slice();
    this.languageErrors = [];
    const dir = `${this.manifest.dir}/languages`;
    const adapter = this.app.vault.adapter;
    const runtimeIds = /* @__PURE__ */ new Set();
    try {
      if (await adapter.exists(dir)) {
        const listed = await adapter.list(dir);
        for (const path of listed.files) {
          if (!path.toLowerCase().endsWith(".js"))
            continue;
          const file = path.split("/").pop();
          try {
            const code = await adapter.read(path);
            const mod = { exports: {} };
            const safeRequire = typeof require !== "undefined" ? require : () => ({});
            new Function("module", "exports", "require", code)(mod, mod.exports, safeRequire);
            const lang = mod.exports;
            const problem = this.validateLanguage(lang);
            if (problem) {
              this.languageErrors.push({ file, error: problem });
              continue;
            }
            if (runtimeIds.has(lang.id)) {
              this.languageErrors.push({ file, error: `duplicate id "${lang.id}"` });
              continue;
            }
            runtimeIds.add(lang.id);
            const idx = this.languages.findIndex((l) => l.id === lang.id);
            if (idx >= 0)
              this.languages[idx] = lang;
            else
              this.languages.push(lang);
          } catch (e) {
            this.languageErrors.push({ file, error: String(e && e.message || e) });
          }
        }
      }
    } catch (e) {
      console.error("Glossary Linker: cannot list languages folder", e);
    }
    this.languages.sort((a, b) => (b.priority || 0) - (a.priority || 0) || a.name.localeCompare(b.name));
    this.languageErrors.sort((a, b) => a.file.localeCompare(b.file));
    if (!Array.isArray(this.settings.enabledLanguages)) {
      this.settings.enabledLanguages = this.languages.map((l) => l.id);
      await this.saveSettings();
    }
    this.refreshActiveLanguages();
  }
  validateLanguage(lang) {
    if (!lang || typeof lang !== "object")
      return "module does not export an object";
    if (!lang.id)
      return 'missing "id"';
    if (!lang.name)
      return 'missing "name"';
    if (typeof lang.match !== "function")
      return "missing match() function";
    if (typeof lang.keys !== "function")
      return "missing keys() function";
    return null;
  }
  refreshActiveLanguages() {
    const enabled = new Set(this.settings.enabledLanguages || []);
    this.activeLanguages = this.languages.filter((l) => enabled.has(l.id));
  }
  isGlossaryPath(path) {
    const p = this.settings.glossaryFolder.replace(/\/+$/, "");
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
  wikiLink(canonical, display) {
    return display === canonical ? `[[${canonical}]]` : `[[${canonical}|${display}]]`;
  }
  // Replace each match (sorted, non-overlapping) with a wikilink, right to left.
  applyLinks(text, matches) {
    const sorted = matches.slice().sort((a, b) => a.start - b.start);
    let out = text;
    for (let j = sorted.length - 1; j >= 0; j--) {
      const m = sorted[j];
      out = out.slice(0, m.start) + this.wikiLink(m.canonical, m.display) + out.slice(m.end);
    }
    const changes = sorted.map((m) => ({ start: m.start, before: m.display, after: this.wikiLink(m.canonical, m.display) }));
    return { newText: out, changes };
  }
  // Navigation / preview shared by Reading view and the editor.
  openTerm(canonical, sourcePath, newTab) {
    this.app.workspace.openLinkText(canonical, sourcePath || "", newTab);
  }
  hoverTerm(event, targetEl, canonical, sourcePath) {
    this.app.workspace.trigger("hover-link", {
      event,
      source: "glossary-linker",
      hoverParent: this,
      targetEl,
      linktext: canonical,
      sourcePath: sourcePath || ""
    });
  }
  inScope(path) {
    for (const ex of splitLines(this.settings.excludeFolders)) {
      if (path === ex || path.startsWith(ex + "/"))
        return false;
    }
    const folders = splitLines(this.settings.scopeFolders);
    const inFolders = folders.some((lf) => path.startsWith(lf + "/"));
    if (this.settings.scopeMode === "folders")
      return inFolders;
    if (this.settings.scopeMode === "except")
      return !inFolders;
    return true;
  }
  getScopeFiles() {
    return this.app.vault.getMarkdownFiles().filter((f) => this.inScope(f.path));
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
};
Object.assign(GlossaryLinkerPlugin.prototype, matcher, highlight, actions);
module.exports = GlossaryLinkerPlugin;
