#!/usr/bin/env node

import { walletExists } from "./src/storage.js";
import { firstRunSetup, mainMenu } from "./src/menus.js";
import { loadSettings } from "./src/settings.js";
import { enableTor } from "./src/tor.js";

const _origStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = (chunk, encoding, cb) => {
  const s = String(chunk);
  if (
    s.includes("JsonRpcProvider") ||
    s.includes("failed to detect network") ||
    s.includes("cannot start up")
  ) {
    if (typeof encoding === "function") encoding(); 
    else if (typeof cb === "function") cb();
    return true;
  }
  return _origStderrWrite(chunk, encoding, cb);
};

const _origWarn = console.warn.bind(console);
console.warn = (...args) => {
  const s = String(args[0] || "");
  if (s.includes("JsonRpcProvider") || s.includes("failed to detect")) return;
  _origWarn(...args);
};

async function main() {
  try {

const settings = await loadSettings();
    if (settings.torEnabled) {
      enableTor(settings.torPort);
      console.log(`  🧅  Tor tunnel: ON (SOCKS5 127.0.0.1:${settings.torPort})\n`);
    }

    if (!(await walletExists())) {
      await firstRunSetup();
    }
    
    while (true) {
      await mainMenu();
    }
  } catch (err) {
    
    if (
      err.name === "ExitPromptError" ||
      (err.message && (
        err.message.includes("User force closed") ||
        err.message.includes("readline was closed") ||
        err.message.includes("force closed the prompt")
      ))
    ) {
      console.log("\n  Goodbye!\n");
      process.exit(0);
    }
    
    console.error("\n  Error:", err.message || err);
    console.log("  Restarting menu...\n");
    await new Promise((r) => setTimeout(r, 1200));
    await main(); 
  }
}

main();
