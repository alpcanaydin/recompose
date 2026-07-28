import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * @param {string} moduleUrl
 * @returns {boolean}
 */
export function isProcessEntryPoint(moduleUrl) {
  const entry = process.argv[1];

  if (entry === undefined) {
    return false;
  }

  try {
    return pathToFileURL(realpathSync(entry)).href === moduleUrl;
  } catch {
    return false;
  }
}
