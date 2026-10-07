

import fs from "fs-extra";
import path from "path";
import os from "os";

const SETTINGS_DIR  = path.join(os.homedir(), ".onionwallet");
const SETTINGS_FILE = path.join(SETTINGS_DIR, "settings.json");

const DEFAULTS = {
  torEnabled: false,
  torPort: 9050, 
};

export async function loadSettings() {
  if (!(await fs.pathExists(SETTINGS_FILE))) return { ...DEFAULTS };
  try {
    const data = await fs.readJson(SETTINGS_FILE);
    return { ...DEFAULTS, ...data };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(patch) {
  const current = await loadSettings();
  const merged = { ...current, ...patch };
  await fs.ensureDir(SETTINGS_DIR);
  await fs.writeJson(SETTINGS_FILE, merged, { spaces: 2 });
  return merged;
}
