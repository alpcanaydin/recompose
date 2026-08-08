import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const ephemeral = { type: 'ephemeral' };

function arrayObjects(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.filter(isJsonObject) : [];
}

function hasCacheControl(values: readonly JsonObject[]): boolean {
  return values.some((value) => value['cache_control'] !== undefined);
}

function injectToolControl(body: JsonObject): void {
  const tools = arrayObjects(body['tools']);

  if (tools.length === 0 || hasCacheControl(tools)) return;

  const selected = tools.findLast((tool) => tool['defer_loading'] !== true);

  if (selected !== undefined) selected['cache_control'] = ephemeral;
}

function systemBlocks(body: JsonObject): JsonObject[] {
  const system = body['system'];

  if (typeof system === 'string') {
    const blocks = [{ type: 'text', text: system }];

    body['system'] = blocks;

    return blocks;
  }

  return arrayObjects(system);
}

function injectSystemControl(body: JsonObject): void {
  const system = systemBlocks(body);

  if (system.length === 0 || hasCacheControl(system)) return;

  const selected = system.at(-1);

  if (selected !== undefined) selected['cache_control'] = ephemeral;
}

function messageContent(message: JsonObject): JsonObject[] {
  const content = message['content'];

  if (typeof content === 'string') {
    const blocks = [{ type: 'text', text: content }];

    message['content'] = blocks;

    return blocks;
  }

  return arrayObjects(content);
}

function messageCacheExists(messages: readonly JsonObject[]): boolean {
  return messages.some((message) => hasCacheControl(messageContent(message)));
}

function secondToLastUser(messages: readonly JsonObject[]): JsonObject | undefined {
  const users = messages.filter((message) => message['role'] === 'user');

  return users.length < 2 ? undefined : users.at(-2);
}

function injectMessageControl(body: JsonObject): void {
  const messages = arrayObjects(body['messages']);

  if (messages.length === 0 || messageCacheExists(messages)) return;

  const content = secondToLastUser(messages);
  const selected = content === undefined ? undefined : messageContent(content).at(-1);

  if (selected !== undefined) selected['cache_control'] = ephemeral;
}

export function ensureClaudeCacheControls(body: JsonObject): JsonObject {
  const cloned = structuredClone(body);

  injectToolControl(cloned);
  injectSystemControl(cloned);
  injectMessageControl(cloned);

  return cloned;
}
