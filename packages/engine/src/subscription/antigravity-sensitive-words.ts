import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const ZERO_WIDTH_SPACE = '\u200B';

function escaped(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function usableWords(words: readonly string[]): string[] {
  const usable: string[] = [];

  for (const raw of words) {
    const word = raw.trim();

    if (Array.from(word).length >= 2 && !word.includes(ZERO_WIDTH_SPACE)) usable.push(word);
  }

  return usable.sort((left, right) => right.length - left.length);
}

function obfuscator(words: readonly string[]): RegExp | null {
  const usable = usableWords(words);

  return usable.length === 0 ? null : new RegExp(usable.map(escaped).join('|'), 'giu');
}

function obfuscatedWord(word: string): string {
  const characters = Array.from(word);

  return characters.length < 2
    ? word
    : `${characters[0] ?? ''}${ZERO_WIDTH_SPACE}${characters.slice(1).join('')}`;
}

function obfuscatedText(text: string, matcher: RegExp): string {
  return text.replace(matcher, obfuscatedWord);
}

function obfuscateParts(instruction: JsonObject, matcher: RegExp): void {
  const rawParts = instruction['parts'];

  if (!Array.isArray(rawParts)) return;

  for (const part of rawParts) obfuscatePart(part, matcher);
}

function obfuscatePart(part: unknown, matcher: RegExp): void {
  if (!isJsonObject(part) || typeof part['text'] !== 'string') return;

  part['text'] = obfuscatedText(part['text'], matcher);
}

function obfuscateInstruction(request: JsonObject, key: string, matcher: RegExp): void {
  const instruction = request[key];

  if (typeof instruction === 'string') {
    request[key] = obfuscatedText(instruction, matcher);

    return;
  }

  if (isJsonObject(instruction)) obfuscateParts(instruction, matcher);
}

export function obfuscateAntigravitySystemInstruction(
  request: JsonObject,
  words: readonly string[],
): void {
  const matcher = obfuscator(words);

  if (matcher === null) return;

  obfuscateInstruction(request, 'systemInstruction', matcher);
  obfuscateInstruction(request, 'system_instruction', matcher);
}
