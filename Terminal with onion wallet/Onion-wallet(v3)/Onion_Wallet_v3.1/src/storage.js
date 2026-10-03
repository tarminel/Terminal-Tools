

import fs from "fs-extra";
import path from "path";
import os from "os";

const WALLET_DIR  = path.join(os.homedir(), ".meshwallet");
const WALLET_FILE = path.join(WALLET_DIR, "wallet.json");

export async function walletExists() {
  return fs.pathExists(WALLET_FILE);
}

export async function saveWallet(data) {
  await fs.ensureDir(WALLET_DIR);
  await fs.writeJson(WALLET_FILE, data, { spaces: 2 });
}

export async function loadWallet() {
  if (!(await walletExists())) return null;
  return fs.readJson(WALLET_FILE);
}

export async function deleteWallet() {
  if (await walletExists()) await fs.remove(WALLET_FILE);
}

export function walletFilePath() {
  return WALLET_FILE;
}
