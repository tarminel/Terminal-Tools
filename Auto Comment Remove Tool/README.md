# 🧹 Auto Comment Remover Tool

A simple Node.js CLI tool that automatically removes all comments from source code files — and saves them in place.

## 📁 Structure

```
Auto Comment Remove tool/
├── run_v2.cjs
└── README.md
```

## ⚡ Usage

```bash
# Single file
node run_v2.cjs index.js

# Multiple files at once
node run_v2.cjs index.js design.js utils.js style.css
```

## ✅ Supported Languages

| Extension | Comment Style |
|-----------|--------------|
| `.js` `.ts` `.jsx` `.tsx` `.mjs` `.cjs` | `//` and `/* */` |
| `.java` `.c` `.cpp` `.cs` `.go` `.php` | `//` and `/* */` |
| `.css` `.scss` | `/* */` |
| `.py` `.rb` `.sh` `.bash` `.yaml` `.toml` | `#` |
| `.html` `.htm` `.xml` `.svg` | `<!-- -->` |

## 🔍 Example

**Before:**
```js
// This is a comment
const name = "tarminel"; // inline comment

/*
  Multi-line comment
*/
function greet(user) {
  return "Hello " + user;
}
```

**After:**
```js
const name = "tarminel";

function greet(user) {
  return "Hello " + user;
}
```

## 📋 Output

```
Processing 3 file(s)...

  [✓] index.js    (120 → 95 lines, -25)
  [✓] design.js   (80 → 72 lines, -8)
  [~] No comments: style.css

──────────────────────────────
  Done   : 2 file(s) cleaned
  Skipped: 1 (no comments found)
  Total  : 33 lines removed
──────────────────────────────
```

## ⚠️ Notes

- Files are **edited in place** — original file is overwritten
- Works even if `package.json` has `"type": "module"` (use `.cjs` extension)
- Strings are safe — comments inside strings are not removed
- Shebang lines (`#!/usr/bin/env node`) are preserved

## 🛠️ Part of [Terminal-Tools](https://github.com/tarminel/Terminal-Tools)
