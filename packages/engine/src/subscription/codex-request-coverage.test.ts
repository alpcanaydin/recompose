import { expect, test } from 'vitest';

import { isJsonObject } from '../gateway-wire';
import { codexProviderRequest } from './codex-request';

const ORIGIN = 'https://chatgpt.com/backend-api/codex';

function requested(fields: Record<string, unknown>) {
  return codexProviderRequest(ORIGIN, fields, { accessToken: 'codex-access' }, 'session-1');
}

function requestBody(fields: Record<string, unknown>): Record<string, unknown> {
  const body: unknown = JSON.parse(requested(fields).body);

  if (!isJsonObject(body)) throw new Error('expected a Codex request body');

  return body;
}

function toolNames(body: Record<string, unknown>): unknown[] {
  const tools = body['tools'];

  return Array.isArray(tools)
    ? tools.map((tool: unknown) => (isJsonObject(tool) ? tool['name'] : undefined))
    : [];
}

test('renames system turns to developer turns and passes other input through', () => {
  const body = requestBody({
    model: 'gpt-5.6',
    input: ['plain', { role: 'system', content: 'rules' }, { role: 'user', content: 'hello' }],
  });

  expect(body['input']).toEqual([
    'plain',
    { role: 'developer', content: 'rules' },
    { role: 'user', content: 'hello' },
  ]);
});

test('bounds an overlong tool name to the Codex limit', () => {
  const overlong = `lookup_${'x'.repeat(70)}`;
  const names = toolNames(requestBody({ model: 'gpt-5.6', tools: [{ name: overlong }] }));

  expect(names[0]).toBe(overlong.slice(0, 64));
});

test('keeps the namespace when it shortens an overlong namespaced tool name', () => {
  const overlong = `mcp__server__${'y'.repeat(70)}`;
  const names = toolNames(requestBody({ model: 'gpt-5.6', tools: [{ name: overlong }] }));

  expect(names[0]).toBe(`mcp__${'y'.repeat(59)}`);
});

test('keeps two tools distinct when bounding collapses them onto one name', () => {
  const overlong = `lookup_${'x'.repeat(70)}`;
  const names = toolNames(
    requestBody({ model: 'gpt-5.6', tools: [{ name: overlong }, { name: `${overlong}_other` }] }),
  );

  expect(names[0]).toBe(overlong.slice(0, 64));
  expect(names[1]).toMatch(/_1$/u);
  expect(names[1]).not.toBe(names[0]);
});

test('keeps a third tool distinct when bounding collapses three onto one name', () => {
  const overlong = `lookup_${'x'.repeat(70)}`;
  const names = toolNames(
    requestBody({
      model: 'gpt-5.6',
      tools: [{ name: overlong }, { name: `${overlong}_two` }, { name: `${overlong}_three` }],
    }),
  );

  expect(names[0]).toBe(overlong.slice(0, 64));
  expect(names[1]).toMatch(/_1$/u);
  expect(names[2]).toMatch(/_2$/u);
  expect(new Set(names.slice(0, 3)).size).toBe(3);
});

test('passes a tool entry that is not an object through untouched', () => {
  const body = requestBody({ model: 'gpt-5.6', tools: ['bare-tool', { name: 'lookup' }] });
  const tools = Array.isArray(body['tools']) ? body['tools'] : [];

  expect(tools.slice(0, 2)).toEqual(['bare-tool', { name: 'lookup' }]);
});

test('leaves a tool that declares no name unnamed', () => {
  const body = requestBody({ model: 'gpt-5.6', tools: [{ type: 'function' }] });

  expect(toolNames(body)[0]).toBeUndefined();
});

test('builds a Responses request when the payload names no model', () => {
  const request = requested({ input: 'hello' });
  const body: unknown = JSON.parse(request.body);

  expect(request.url).toBe(`${ORIGIN}/responses`);
  expect(isJsonObject(body) ? body['stream'] : undefined).toBe(true);
});
