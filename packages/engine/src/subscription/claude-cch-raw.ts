import type { ClaudeRawJsonEdit } from './claude-raw-json';

import { applyClaudeRawJsonEdits } from './claude-raw-json';

const omitted = new Set(['max_tokens', 'fallbacks', 'fallback_credit_token']);

type Member = {
  start: number;
  end: number;
  commaBefore: number;
  commaAfter: number;
  excluded: boolean;
};

export function normalizeClaudeCchInputRaw(body: Uint8Array): Uint8Array | null {
  const text = new TextDecoder().decode(body);

  if (!validJson(text)) return null;

  const scanner = new Scanner(text);

  if (!scanner.scan()) return null;

  return applyStringEdits(body, text, scanner.edits);
}

function validJson(text: string): boolean {
  try {
    JSON.parse(text);

    return true;
  } catch {
    return false;
  }
}

function applyStringEdits(
  body: Uint8Array,
  text: string,
  edits: readonly ClaudeRawJsonEdit[],
): Uint8Array | null {
  const encoder = new TextEncoder();
  const byteEdits = edits.map((edit) => ({
    ...edit,
    start: encoder.encode(text.slice(0, edit.start)).byteLength,
    end: encoder.encode(text.slice(0, edit.end)).byteLength,
  }));

  return applyClaudeRawJsonEdits(body, byteEdits);
}

class Scanner {
  readonly edits: ClaudeRawJsonEdit[] = [];
  private position = 0;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  scan(): boolean {
    return this.value(true) && (this.space(), this.position === this.text.length);
  }

  private value(collect: boolean): boolean {
    this.space();

    if (this.peek() === '{') return this.object(collect);
    if (this.peek() === '[') return this.array(collect);
    if (this.peek() === '"') return this.string() !== null;

    return this.primitive();
  }

  private object(collect: boolean): boolean {
    this.position += 1;
    this.space();
    if (this.consume('}')) return true;

    const members = this.objectMembers(collect);

    if (members === null || !this.consume('}')) return false;
    if (collect) this.excludedRuns(members);

    return true;
  }

  private objectMembers(collect: boolean): Member[] | null {
    const members: Member[] = [];
    let commaBefore = -1;

    while (this.position < this.text.length) {
      const member = this.member(collect, commaBefore);

      if (member === null) return null;
      members.push(member);
      if (member.commaAfter < 0) return members;
      commaBefore = member.commaAfter;
    }

    return null;
  }

  private member(collect: boolean, commaBefore: number): Member | null {
    const header = this.memberHeader();

    if (header === null) return null;

    const excluded = excludedKey(collect, header.key);
    const valueStart = this.position;

    if (!this.value(nestedCollection(collect, excluded))) return null;
    if (modelKey(collect, header.key)) this.emptyStringValue(valueStart);

    const end = this.position;

    this.space();
    const commaAfter = this.consume(',') ? this.position - 1 : -1;

    return { start: header.start, end, commaBefore, commaAfter, excluded };
  }

  private memberHeader(): { start: number; key: string } | null {
    this.space();
    const start = this.position;
    const keyToken = this.string();

    if (keyToken === null || !this.afterColon()) return null;

    return { start, key: decodedString(keyToken) };
  }

  private afterColon(): boolean {
    this.space();
    if (!this.consume(':')) return false;
    this.space();

    return true;
  }

  private emptyStringValue(start: number): void {
    if (this.text[start] === '"' && this.position > start + 1) {
      this.edits.push({ start: start + 1, end: this.position - 1 });
    }
  }

  private array(collect: boolean): boolean {
    this.position += 1;
    this.space();
    if (this.consume(']')) return true;

    while (this.value(collect)) {
      this.space();
      if (this.consume(']')) return true;
      if (!this.consume(',')) return false;
    }

    return false;
  }

  private string(): string | null {
    if (!this.consume('"')) return null;

    const start = this.position - 1;

    while (this.position < this.text.length) {
      const character = this.text[this.position];

      this.position += 1;
      if (character === '\\') this.position += 1;
      else if (character === '"') return this.text.slice(start, this.position);
    }

    return null;
  }

  private primitive(): boolean {
    const start = this.position;

    while (this.position < this.text.length && !/[\s,}\]]/u.test(this.peek())) {
      this.position += 1;
    }

    return this.position > start;
  }

  private excludedRuns(members: readonly Member[]): void {
    let start = 0;

    while (start < members.length) {
      if (!memberExcluded(members, start)) {
        start += 1;
        continue;
      }

      let end = start;

      while (memberExcluded(members, end + 1)) end += 1;
      this.addExcludedRun(members, start, end);
      start = end + 1;
    }
  }

  private addExcludedRun(members: readonly Member[], start: number, end: number): void {
    const range = excludedRange(members, start, end);

    if (range !== null) this.edits.push(range);
  }

  private space(): void {
    while (/\s/u.test(this.peek())) this.position += 1;
  }

  private consume(character: string): boolean {
    if (this.peek() !== character) return false;
    this.position += 1;

    return true;
  }

  private peek(): string {
    return this.text[this.position] ?? '';
  }
}

function excludedKey(collect: boolean, key: string): boolean {
  return collect ? omitted.has(key) : false;
}

function nestedCollection(collect: boolean, excluded: boolean): boolean {
  return collect && !excluded;
}

function modelKey(collect: boolean, key: string): boolean {
  return collect && key === 'model';
}

function memberExcluded(members: readonly Member[], index: number): boolean {
  return members[index]?.excluded === true;
}

function excludedRange(
  members: readonly Member[],
  start: number,
  end: number,
): ClaudeRawJsonEdit | null {
  const first = members[start];
  const last = members[end];

  if (first === undefined || last === undefined) return null;
  if (start === 0) return leadingRange(members.length, end, first, last);

  return trailingRange(members.length, start, end, first, last);
}

function leadingRange(length: number, end: number, first: Member, last: Member): ClaudeRawJsonEdit {
  return { start: first.start, end: end === length - 1 ? last.end : last.commaAfter + 1 };
}

function trailingRange(
  length: number,
  start: number,
  end: number,
  first: Member,
  last: Member,
): ClaudeRawJsonEdit {
  const trailing = end === length - 1;
  const editStart = trailing && start === end ? first.commaBefore : first.start;

  return { start: editStart, end: trailing ? last.end : last.commaAfter + 1 };
}

function decodedString(token: string): string {
  const decoded: unknown = JSON.parse(token);

  return typeof decoded === 'string' ? decoded : '';
}
