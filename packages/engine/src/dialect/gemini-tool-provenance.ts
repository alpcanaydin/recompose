import { createHash } from 'node:crypto';

import { canonicalJson } from '../subscription/canonical-json';

const PREFIX = 'cpa_gemini_';
const DIGEST = /^[a-f0-9]{32}$/u;

export function geminiClaudeToolUseId(id: string, name: string, args: unknown): string {
  const nativeId = id.trim();
  const toolName = name.trim();

  if (nativeId === '' || toolName === '') return '';

  const source = `${nativeId}\0${toolName}\0${canonicalJson(args)}`;
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 32);

  return `${PREFIX}${digest}`;
}

export function isGeminiClaudeToolUseId(id: string): boolean {
  const value = id.trim();

  return value.startsWith(PREFIX) && DIGEST.test(value.slice(PREFIX.length));
}
