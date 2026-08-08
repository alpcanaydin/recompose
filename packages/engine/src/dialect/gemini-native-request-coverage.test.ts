import { describe, expect, test } from 'vitest';

import type { GeminiContent, GeminiPart, GeminiRequest } from './gemini-wire';

import { backfillGeminiFunctionResponseNames } from './gemini-native-request';

function requestOf(...contents: GeminiContent[]): GeminiRequest {
  return { contents };
}

function modelTurn(...parts: GeminiPart[]): GeminiContent {
  return { role: 'model', parts };
}

function userTurn(...parts: GeminiPart[]): GeminiContent {
  return { role: 'user', parts };
}

function call(name: string): GeminiPart {
  return { functionCall: { name, args: {} } };
}

function answer(name: string): GeminiPart {
  return { functionResponse: { name, response: { result: 'ok' } } };
}

function responseNames(request: GeminiRequest): string[] {
  return request.contents.flatMap((content) =>
    content.parts.flatMap((part) =>
      part.functionResponse === undefined ? [] : [part.functionResponse.name],
    ),
  );
}

describe('naming function answers after the calls that asked for them', () => {
  test('prose spoken alongside a call is not counted as a call', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(modelTurn({ text: 'let me look' }, call('Bash')), userTurn(answer(''))),
    );

    expect(responseNames(normalized)).toStrictEqual(['Bash']);
  });

  test('prose sent alongside an answer does not consume a call name', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(
        modelTurn(call('Read'), call('Grep')),
        userTurn({ text: 'here you go' }, answer(''), answer('')),
      ),
    );

    expect(responseNames(normalized)).toStrictEqual(['Read', 'Grep']);
  });

  test('a turn that follows no call at all is left untouched', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(userTurn(answer('')), userTurn({ text: 'still nothing' })),
    );

    expect(responseNames(normalized)).toStrictEqual(['']);
  });

  test('a second answer turn after one model turn is left untouched', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(modelTurn(call('Bash')), userTurn(answer('')), userTurn(answer(''))),
    );

    expect(responseNames(normalized)).toStrictEqual(['Bash', '']);
  });

  test('a model turn that asks for nothing clears the names it was holding', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(modelTurn(call('Bash')), modelTurn({ text: 'never mind' }), userTurn(answer(''))),
    );

    expect(responseNames(normalized)).toStrictEqual(['']);
  });

  test('a turn without a role is treated as an answering turn', () => {
    const normalized = backfillGeminiFunctionResponseNames(
      requestOf(modelTurn(call('Bash')), { parts: [answer('')] }),
    );

    expect(responseNames(normalized)).toStrictEqual(['Bash']);
  });
});
