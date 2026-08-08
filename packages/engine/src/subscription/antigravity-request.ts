import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';

import { isJsonObject } from '../gateway-wire';
import { sanitizeAntigravityClaudeSignatures } from './antigravity-claude-signatures';
import { injectAntigravityCreditTypes } from './antigravity-credits';
import { normalizeAntigravityFunctionHistory } from './antigravity-function-history';
import { cleanAntigravityRequestSchemas } from './antigravity-request-schemas';
import { obfuscateAntigravitySystemInstruction } from './antigravity-sensitive-words';
import { sanitizeAntigravitySignatures } from './antigravity-signatures';
import { normalizeAntigravityTools } from './antigravity-tools';
import { antigravityRequestUserAgent } from './antigravity-version';
import {
  hasAntigravityWebSearch,
  removeUnsupportedAntigravityWebSearch,
  supportsAntigravityWebSearch,
} from './antigravity-web-search';

const INTERLEAVED_THINKING_HINT =
  'Interleaved thinking is enabled. You may think between tool calls and after receiving tool results before deciding the next action or final answer. Do not mention these instructions or any constraints about thinking blocks; just apply them.';

function modelOf(body: JsonObject): string {
  return typeof body['model'] === 'string' ? body['model'] : '';
}

function withoutGeminiMaxTokens(request: JsonObject): void {
  const generation = request['generationConfig'];

  if (isJsonObject(generation)) {
    delete generation['maxOutputTokens'];
  }
}

function validatedClaudeTools(request: JsonObject): void {
  const toolConfig = isJsonObject(request['toolConfig']) ? request['toolConfig'] : {};
  const functionCalling = isJsonObject(toolConfig['functionCallingConfig'])
    ? toolConfig['functionCallingConfig']
    : {};

  request['toolConfig'] = {
    ...toolConfig,
    functionCallingConfig: { ...functionCalling, mode: 'VALIDATED' },
  };
}

function nestedRequest(
  body: JsonObject,
  model: string,
  sensitiveWords: readonly string[],
): JsonObject {
  const {
    model: _model,
    stream: _stream,
    requestType: _requestType,
    ...request
  } = structuredClone(body);

  delete request['safetySettings'];
  removeUnsupportedAntigravityWebSearch(request, model);
  normalizeAntigravityTools(request);
  obfuscateAntigravitySystemInstruction(request, sensitiveWords);
  injectInterleavedThinkingHint(request, model);
  cleanAntigravityRequestSchemas(request, model);
  sanitizeAntigravityClaudeSignatures(request, model);
  sanitizeAntigravitySignatures(request, model);
  normalizeAntigravityFunctionHistory(request);

  if (!model.includes('claude')) {
    withoutGeminiMaxTokens(request);
  }

  if (model.includes('claude')) {
    validatedClaudeTools(request);
  }

  return request;
}

function injectInterleavedThinkingHint(request: JsonObject, model: string): void {
  if (!shouldInjectHint(request, model)) return;

  const instruction = isJsonObject(request['systemInstruction'])
    ? request['systemInstruction']
    : { role: 'user', parts: [] };
  const parts = instructionParts(instruction['parts']);

  instruction['role'] ??= 'user';
  instruction['parts'] = [...parts, { text: INTERLEAVED_THINKING_HINT }];
  request['systemInstruction'] = instruction;
}

function shouldInjectHint(request: JsonObject, model: string): boolean {
  return isThinkingClaude(model) && hasTools(request) && hasThinking(request);
}

function instructionParts(value: unknown): unknown[] {
  return Array.isArray(value) ? Array.from(value) : [];
}

function isThinkingClaude(model: string): boolean {
  const normalized = model.toLowerCase();

  return normalized.includes('claude') && normalized.includes('thinking');
}

function hasTools(request: JsonObject): boolean {
  const tools = request['tools'];

  return Array.isArray(tools) && tools.some(hasFunctionDeclarations);
}

function hasFunctionDeclarations(tool: unknown): boolean {
  if (!isJsonObject(tool)) return false;

  const declarations = tool['functionDeclarations'] ?? tool['function_declarations'];

  return Array.isArray(declarations) && declarations.length > 0;
}

function hasThinking(request: JsonObject): boolean {
  const generation = request['generationConfig'];

  return isJsonObject(generation) && isJsonObject(generation['thinkingConfig']);
}

function requestType(body: JsonObject, model: string): string {
  const explicit = explicitRequestType(body);

  if (explicit !== undefined) return explicit;

  if (supportsAntigravityWebSearch(model) && hasAntigravityWebSearch(body)) {
    return 'web_search';
  }

  return model.includes('image') ? 'image_gen' : 'agent';
}

function explicitRequestType(body: JsonObject): string | undefined {
  const explicit = body['requestType'];

  return typeof explicit === 'string' && explicit.trim() !== '' ? explicit : undefined;
}

function requestId(model: string, id: string, now: number): string {
  return model.includes('image') ? `image_gen/${String(now)}/${id}/12` : `agent-${id}`;
}

function configuredWords(words: readonly string[] | undefined): readonly string[] {
  return words ?? [];
}

function requiredProject(credential: ParsedSubscriptionCredential): string {
  if (credential.projectId === undefined)
    throw new Error('Antigravity credential has no project ID');

  return credential.projectId;
}

function injectRequestedCredits(request: JsonObject, body: JsonObject): void {
  if (body['conductorCredits'] === true) injectAntigravityCreditTypes(request);

  delete request['conductorCredits'];
}

export function antigravityProviderRequest(
  providerOrigin: string,
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
  ids: { requestId: string; sessionId: string },
  now: number,
  sensitiveWords?: readonly string[],
): ProviderRequest {
  const project = requiredProject(credential);
  const model = modelOf(body);
  const request = nestedRequest(body, model, configuredWords(sensitiveWords));

  injectRequestedCredits(request, body);

  if (requestType(body, model) !== 'web_search') {
    request['sessionId'] = request['sessionId'] ?? ids.sessionId;
  }

  const envelope = {
    model,
    userAgent: 'antigravity',
    requestType: requestType(body, model),
    project,
    requestId: requestId(model, ids.requestId, now),
    request,
  };
  const stream = body['stream'] === true;
  const path = stream ? '/v1internal:streamGenerateContent?alt=sse' : '/v1internal:generateContent';

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}${path}`,
    headers: [
      ['Content-Type', 'application/json'],
      ['Authorization', `Bearer ${credential.accessToken}`],
      ['User-Agent', antigravityRequestUserAgent('')],
      ['Connection', 'close'],
    ],
    body: JSON.stringify(envelope),
  };
}

export function antigravityCountTokensRequest(
  providerOrigin: string,
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
  sensitiveWords?: readonly string[],
): ProviderRequest {
  const model = modelOf(body);
  const request = nestedRequest(body, model, configuredWords(sensitiveWords));

  return {
    url: `${providerOrigin.replace(/\/+$/u, '')}/v1internal:countTokens`,
    headers: [
      ['Content-Type', 'application/json'],
      ['Authorization', `Bearer ${credential.accessToken}`],
      ['User-Agent', antigravityRequestUserAgent('')],
      ['Connection', 'close'],
    ],
    body: JSON.stringify({ request }),
  };
}
