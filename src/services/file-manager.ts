import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { getBaseDir, getConfig } from "../config.js";

/** Allowed file paths (relative to the project base dir) */
function getAllowedFilesMap(): Record<string, string> {
  const config = getConfig();
  const cf = config.config_files || {} as any;
  
  return {
    "config.json": "config.json",
    "worldserver.conf": cf.worldserver_conf || "../Repack/worldserver.conf",
    "authserver.conf": cf.authserver_conf || "../Repack/authserver.conf",
    "my.ini": cf.my_ini || "../Database/_Server/mysql/my.ini",
    "my.cnf": cf.my_cnf || "../Database/_Server/mysql/bin/my.cnf",
  };
}

function resolveAllowedPath(fileKey: string): string | null {
  const allowed = getAllowedFilesMap();
  const relativePath = allowed[fileKey];
  if (!relativePath) return null;
  return resolve(getBaseDir(), relativePath);
}

export function getAllowedFiles(): string[] {
  return Object.keys(getAllowedFilesMap());
}

export function readConfigFile(fileKey: string): { success: boolean; content?: string; error?: string } {
  const absPath = resolveAllowedPath(fileKey);
  if (!absPath) {
    return {
      success: false,
      error: `File "${fileKey}" is not in the allowed file list. Allowed: ${getAllowedFiles().join(", ")}`,
    };
  }

  try {
    const content = readFileSync(absPath, "utf-8");
    return { success: true, content };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: `Failed to read file: ${error.message}` };
  }
}

export function writeConfigFile(
  fileKey: string,
  content: string
): { success: boolean; error?: string } {
  const absPath = resolveAllowedPath(fileKey);
  if (!absPath) {
    return {
      success: false,
      error: `File "${fileKey}" is not in the allowed file list. Allowed: ${getAllowedFiles().join(", ")}`,
    };
  }

  try {
    writeFileSync(absPath, content, "utf-8");
    return { success: true };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: `Failed to write file: ${error.message}` };
  }
}

/**
 * Search and replace a specific value in a config file.
 * Useful for updating individual settings in .conf files.
 */
export function updateConfValue(
  fileKey: string,
  key: string,
  value: string
): { success: boolean; oldValue?: string; error?: string } {
  const absPath = resolveAllowedPath(fileKey);
  if (!absPath) {
    return {
      success: false,
      error: `File "${fileKey}" is not in the allowed file list.`,
    };
  }

  try {
    let content = readFileSync(absPath, "utf-8");
    // Match lines like: Key = Value (with optional spaces, ignoring comments)
    const regex = new RegExp(`^(${escapeRegex(key)}\\s*=\\s*)(.*)$`, "m");
    const match = content.match(regex);

    if (!match) {
      return { success: false, error: `Key "${key}" not found in ${fileKey}` };
    }

    const oldValue = match[2].trim();
    content = content.replace(regex, `$1${value}`);
    writeFileSync(absPath, content, "utf-8");
    return { success: true, oldValue };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: `Failed to update config: ${error.message}` };
  }
}

/**
 * Get a specific value from a conf file.
 */
export function getConfValue(
  fileKey: string,
  key: string
): { success: boolean; value?: string; error?: string } {
  const absPath = resolveAllowedPath(fileKey);
  if (!absPath) {
    return {
      success: false,
      error: `File "${fileKey}" is not in the allowed file list.`,
    };
  }

  try {
    const content = readFileSync(absPath, "utf-8");
    const regex = new RegExp(`^${escapeRegex(key)}\\s*=\\s*(.*)$`, "m");
    const match = content.match(regex);

    if (!match) {
      return { success: false, error: `Key "${key}" not found in ${fileKey}` };
    }

    return { success: true, value: match[1].trim() };
  } catch (err: unknown) {
    const error = err as Error;
    return { success: false, error: `Failed to read config: ${error.message}` };
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
