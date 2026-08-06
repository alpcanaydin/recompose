import type { JsonObject } from '../gateway-wire';
import type { ProviderRequest } from './claude-request';
import type { ParsedSubscriptionCredential } from './credentials';

import { isJsonObject } from '../gateway-wire';

const USER_AGENT = 'antigravity/hub';

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

function nestedRequest(body: JsonObject, model: string): JsonObject {
  const {
    model: _model,
    stream: _stream,
    requestType: _requestType,
    ...request
  } = structuredClone(body);

  delete request['safetySettings'];

  if (!model.includes('claude')) {
    withoutGeminiMaxTokens(request);
  }

  if (model.includes('claude')) {
    validatedClaudeTools(request);
  }

  return request;
}

function requestType(body: JsonObject, model: string): string {
  const explicit = body['requestType'];

  if (typeof explicit === 'string' && explicit.trim() !== '') {
    return explicit;
  }

  return model.includes('image') ? 'image_gen' : 'agent';
}

function requestId(model: string, id: string, now: number): string {
  return model.includes('image') ? `image_gen/${String(now)}/${id}/12` : `agent-${id}`;
}

export function antigravityProviderRequest(
  providerOrigin: string,
  body: JsonObject,
  credential: ParsedSubscriptionCredential,
  ids: { requestId: string; sessionId: string },
  now: number,
): ProviderRequest {
  const model = modelOf(body);
  const request = nestedRequest(body, model);

  if (requestType(body, model) !== 'web_search') {
    request['sessionId'] = request['sessionId'] ?? ids.sessionId;
  }

  const envelope = {
    model,
    userAgent: 'antigravity',
    requestType: requestType(body, model),
    ...(credential.projectId === undefined ? {} : { project: credential.projectId }),
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
      ['User-Agent', USER_AGENT],
      ['Connection', 'close'],
    ],
    body: JSON.stringify(envelope),
  };
}
