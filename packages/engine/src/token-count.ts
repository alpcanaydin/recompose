import { getEncoding } from 'js-tiktoken';

import type { JsonObject } from './gateway-wire';

import { isJsonObject } from './gateway-wire';

type EncodingName = Parameters<typeof getEncoding>[0];

const encoders = new Map<EncodingName, ReturnType<typeof getEncoding>>();

function encoderFor(encoding: EncodingName): ReturnType<typeof getEncoding> {
  const cached = encoders.get(encoding);

  if (cached !== undefined) {
    return cached;
  }

  const created = getEncoding(encoding);

  encoders.set(encoding, created);

  return created;
}

function trimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function appendString(segments: string[], value: unknown): void {
  const text = trimmedString(value);

  if (text !== undefined) {
    segments.push(text);
  }
}

function appendJson(segments: string[], value: unknown): void {
  if (value !== undefined && value !== null) {
    segments.push(typeof value === 'string' ? value : JSON.stringify(value));
  }
}

function collectClaudeDocument(value: JsonObject, segments: string[]): void {
  const source = value['source'];

  if (!isJsonObject(source) || source['type'] !== 'text') {
    return;
  }

  appendString(segments, value['title']);
  appendString(segments, value['context']);
  appendString(segments, source['data']);
  appendString(segments, source['content']);
}

function collectClaudeResult(value: JsonObject, segments: string[]): void {
  appendString(segments, value['tool_use_id']);
  appendString(segments, value['tool_call_id']);
  collectClaudeContent(value['content'], segments);
}

function collectClaudeSearch(value: JsonObject, segments: string[]): void {
  appendString(segments, value['source']);
  appendString(segments, value['title']);
  appendString(segments, value['url']);
  appendString(segments, value['page_age']);
  collectClaudeContent(value['content'], segments);
}

function collectClaudeToolUse(value: JsonObject, segments: string[]): void {
  appendString(segments, value['id']);
  appendString(segments, value['name']);
  appendJson(segments, value['input']);
}

const ignoredClaudeContent = new Set([
  'image',
  'input_audio',
  'audio',
  'video',
  'redacted_thinking',
]);

type ContentCollector = (value: JsonObject, segments: string[]) => void;

const collectTextFallback: ContentCollector = (value, segments) => {
  appendString(segments, value['text']);
};

const claudeContentCollectors: Record<string, ContentCollector> = {
  text: (value, segments) => {
    appendString(segments, value['text']);
  },
  thinking: (value, segments) => {
    appendString(segments, value['thinking']);
  },
  document: collectClaudeDocument,
  tool_use: collectClaudeToolUse,
  server_tool_use: collectClaudeToolUse,
  mcp_tool_use: collectClaudeToolUse,
  tool_result: collectClaudeResult,
  mcp_tool_result: collectClaudeResult,
  web_search_tool_result: collectClaudeResult,
  web_fetch_tool_result: collectClaudeResult,
  code_execution_tool_result: collectClaudeResult,
  bash_code_execution_tool_result: collectClaudeResult,
  text_editor_code_execution_tool_result: collectClaudeResult,
  web_search_result: collectClaudeSearch,
  search_result: collectClaudeSearch,
};

function collectableClaudeObject(value: unknown): JsonObject | undefined {
  return isJsonObject(value) && !ignoredClaudeContent.has(String(value['type']))
    ? value
    : undefined;
}

function collectClaudeContent(value: unknown, segments: string[]): void {
  if (typeof value === 'string') {
    appendString(segments, value);

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((part) => {
      collectClaudeContent(part, segments);
    });

    return;
  }

  const collectable = collectableClaudeObject(value);

  if (collectable === undefined) {
    return;
  }

  const collector = claudeContentCollectors[String(collectable['type'])] ?? collectTextFallback;

  collector(collectable, segments);
}

function claudeSystemText(value: unknown): unknown {
  if (typeof value === 'string') {
    return value;
  }

  return isJsonObject(value) && value['type'] === 'text' ? value['text'] : undefined;
}

function collectClaudeSystem(value: unknown, segments: string[]): void {
  const parts = Array.isArray(value) ? value : [value];

  parts.forEach((part) => {
    appendString(segments, claudeSystemText(part));
  });
}

function collectClaudeMessage(value: unknown, segments: string[]): void {
  if (isJsonObject(value)) {
    appendString(segments, value['role']);
    collectClaudeContent(value['content'], segments);
  }
}

function collectClaudeTool(value: unknown, segments: string[]): void {
  if (isJsonObject(value)) {
    appendString(segments, value['type']);
    appendString(segments, value['name']);
    appendString(segments, value['description']);
    appendJson(segments, value['input_schema']);
  }
}

function collectClaudeChoice(value: unknown, segments: string[]): void {
  if (typeof value === 'string') {
    appendString(segments, value);
  } else if (isJsonObject(value)) {
    appendString(segments, value['type']);
    appendString(segments, value['name']);
  }
}

function claudeSegments(body: JsonObject): string[] {
  const segments: string[] = [];

  collectClaudeSystem(body['system'], segments);
  (Array.isArray(body['messages']) ? body['messages'] : []).forEach((message) => {
    collectClaudeMessage(message, segments);
  });
  (Array.isArray(body['tools']) ? body['tools'] : []).forEach((tool) => {
    collectClaudeTool(tool, segments);
  });
  collectClaudeChoice(body['tool_choice'], segments);

  return segments;
}

function collectCodexMessage(value: JsonObject, segments: string[]): void {
  (Array.isArray(value['content']) ? value['content'] : []).forEach((part) => {
    appendString(segments, isJsonObject(part) ? part['text'] : undefined);
  });
}

function collectCodexCall(value: JsonObject, segments: string[]): void {
  appendString(segments, value['name']);
  appendString(segments, value['arguments']);
}

const codexCollectors: Record<string, ContentCollector> = {
  message: collectCodexMessage,
  function_call: collectCodexCall,
  function_call_output: (value, segments) => {
    appendString(segments, value['output']);
  },
};

function collectCodexItem(value: unknown, segments: string[]): void {
  if (!isJsonObject(value)) {
    return;
  }

  const collector = codexCollectors[String(value['type'])] ?? collectTextFallback;

  collector(value, segments);
}

function collectCodexInput(value: unknown, segments: string[]): void {
  (Array.isArray(value) ? value : []).forEach((item) => {
    collectCodexItem(item, segments);
  });
}

function collectCodexTool(value: unknown, segments: string[]): void {
  if (isJsonObject(value)) {
    appendString(segments, value['name']);
    appendString(segments, value['description']);
    appendJson(segments, value['parameters']);
  }
}

function collectCodexFormat(value: unknown, segments: string[]): void {
  if (isJsonObject(value)) {
    appendString(segments, value['name']);
    appendJson(segments, value['schema']);
  }
}

function codexSegments(body: JsonObject): string[] {
  const segments: string[] = [];

  appendString(segments, body['instructions']);
  collectCodexInput(body['input'], segments);
  (Array.isArray(body['tools']) ? body['tools'] : []).forEach((tool) => {
    collectCodexTool(tool, segments);
  });

  const format = isJsonObject(body['text']) ? body['text']['format'] : undefined;

  collectCodexFormat(format, segments);

  return segments;
}

function countSegments(encoding: EncodingName, segments: string[]): number {
  return segments.length === 0 ? 0 : encoderFor(encoding).encode(segments.join('\n')).length;
}

export function countClaudeInputTokens(body: JsonObject): number {
  return countSegments('o200k_base', claudeSegments(body));
}

export function countCodexInputTokens(body: JsonObject, model: string): number {
  const normalized = model.trim().toLowerCase();
  const modern =
    normalized.startsWith('gpt-5') ||
    normalized.startsWith('gpt-4.1') ||
    normalized.startsWith('gpt-4o');

  return countSegments(modern ? 'o200k_base' : 'cl100k_base', codexSegments(body));
}
