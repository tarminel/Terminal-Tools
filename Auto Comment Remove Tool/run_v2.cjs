#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const targets = process.argv.slice(2);

if (targets.length === 0) {
  console.error("Usage: node run.cjs <file1> [file2] [file3] ...");
  console.error("Example: node run.cjs index.js design.js style.css");
  process.exit(1);
}

function removeComments(code, fileExt) {
  const cStyleExts = [
    ".js", ".ts", ".jsx", ".tsx", ".mjs", ".cjs",
    ".java", ".c", ".cpp", ".cs", ".go", ".swift",
    ".kt", ".rs", ".dart", ".php", ".scss", ".css",
  ];
  const hashStyleExts = [
    ".py", ".rb", ".sh", ".bash", ".zsh", ".pl",
    ".r", ".yaml", ".yml", ".toml", ".conf", ".ini",
  ];
  const htmlStyleExts = [".html", ".htm", ".xml", ".svg"];

  if (cStyleExts.includes(fileExt))       return removeCStyleComments(code);
  else if (hashStyleExts.includes(fileExt)) return removeHashComments(code);
  else if (htmlStyleExts.includes(fileExt)) return removeHtmlComments(code);
  else {
    console.warn(`  [!] Unknown extension "${fileExt}", trying C-style removal.`);
    return removeCStyleComments(code);
  }
}

function removeCStyleComments(code) {
  let result = "";
  let i = 0;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      result += ch;
      i++;
      while (i < len) {
        const c = code[i];
        result += c;
        if (c === "\\" && i + 1 < len) {
          i++;
          result += code[i];
        } else if (c === quote) {
          break;
        }
        i++;
      }
      i++;
      continue;
    }

    if (ch === "/" && i + 1 < len && code[i + 1] === "/") {
      while (i < len && code[i] !== "\n") i++;
      continue;
    }

    if (ch === "/" && i + 1 < len && code[i + 1] === "*") {
      i += 2;
      while (i < len) {
        if (code[i] === "*" && i + 1 < len && code[i + 1] === "/") {
          i += 2;
          break;
        }
        i++;
      }
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}

function removeHashComments(code) {
  return code
    .split("\n")
    .map((line) => {
      if (line.startsWith("#!")) return line;
      let inString = false;
      let strChar = "";
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (!inString && (c === '"' || c === "'")) {
          inString = true;
          strChar = c;
        } else if (inString && c === strChar && line[i - 1] !== "\\") {
          inString = false;
        } else if (!inString && c === "#") {
          return line.slice(0, i);
        }
      }
      return line;
    })
    .join("\n");
}

function removeHtmlComments(code) {
  return code.replace(/<!--[\s\S]*?-->/g, "");
}

function cleanBlankLines(code) {
  return code.replace(/(\n\s*){3,}/g, "\n\n");
}

let totalSaved = 0;
let successCount = 0;
let skipCount = 0;
let errorCount = 0;

console.log(`\nProcessing ${targets.length} file(s)...\n`);

for (const target of targets) {
  const filePath = path.resolve(target);

  if (!fs.existsSync(filePath)) {
    console.error(`  [✗] Not found: ${target}`);
    errorCount++;
    continue;
  }

  const original = fs.readFileSync(filePath, "utf8");
  const ext = path.extname(filePath).toLowerCase();

  let cleaned = removeComments(original, ext);
  cleaned = cleanBlankLines(cleaned);

  if (cleaned === original) {
    console.log(`  [~] No comments: ${target}`);
    skipCount++;
    continue;
  }

  fs.writeFileSync(filePath, cleaned, "utf8");

  const before = original.split("\n").length;
  const after = cleaned.split("\n").length;
  const saved = before - after;
  totalSaved += saved;
  successCount++;

  console.log(`  [✓] ${target}  (${before} → ${after} lines, -${saved})`);
}

console.log(`\n──────────────────────────────`);
console.log(`  Done   : ${successCount} file(s) cleaned`);
if (skipCount > 0)  console.log(`  Skipped: ${skipCount} (no comments found)`);
if (errorCount > 0) console.log(`  Errors : ${errorCount} (file not found)`);
if (totalSaved > 0) console.log(`  Total  : ${totalSaved} lines removed`);
console.log(`──────────────────────────────\n`);
