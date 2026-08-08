import { describe, expect, it } from 'vitest';

import { normalizeAntigravityFunctionHistory } from './antigravity-function-history';

describe('Antigravity tool-result name parity', () => {
  it('should restore Toulu-format result names from matching calls', () => {
    const first = 'toolu_tool-48fca351f12844eabf49dad8b63886d2';
    const second = 'toolu_tool-cf2d061f75f845c49aacc18ee75ee708';
    const request = history(
      [call(first, 'Glob'), call(second, 'Bash')],
      [response(first), response(second)],
    );

    normalizeAntigravityFunctionHistory(request);

    expect(request).toHaveProperty('contents.1.parts.0.functionResponse.name', 'Glob');
    expect(request).toHaveProperty('contents.1.parts.1.functionResponse.name', 'Bash');
  });

  it('should restore custom-format result names from matching calls', () => {
    const id = 'Read-1773420180464065165-1327';
    const request = history([call(id, 'Read')], [response(id)]);

    normalizeAntigravityFunctionHistory(request);

    expect(request).toHaveProperty('contents.1.parts.0.functionResponse.name', 'Read');
  });

  it('should derive a semantic name when no call exists', () => {
    const request = { contents: [{ role: 'user', parts: [response('get_weather-call-123')] }] };

    normalizeAntigravityFunctionHistory(request);

    expect(request).toHaveProperty('contents.0.parts.0.functionResponse.name', 'get_weather');
  });

  it('should retain the raw ID when no semantic fallback exists', () => {
    const id = 'toolu_tool-48fca351f12844eabf49dad8b63886d2';
    const request = { contents: [{ role: 'user', parts: [response(id)] }] };

    normalizeAntigravityFunctionHistory(request);

    expect(request).toHaveProperty('contents.0.parts.0.functionResponse.name', id);
  });
});

function history(calls: unknown[], responses: unknown[]) {
  return {
    contents: [
      { role: 'model', parts: calls },
      { role: 'user', parts: responses },
    ],
  };
}

function call(id: string, name: string) {
  return { functionCall: { id, name, args: {} } };
}

function response(id: string) {
  return { functionResponse: { id, name: id, response: { result: 'ok' } } };
}
