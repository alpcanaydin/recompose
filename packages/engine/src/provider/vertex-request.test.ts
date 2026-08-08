import { describe, expect, test } from 'vitest';

import type { Crossing, JsonObject } from '../gateway-wire';

import {
  parseVertexCredential,
  stripVertexToolCallIds,
  vertexCountBody,
  vertexHeaders,
  vertexProviderBody,
  vertexRequestUrl,
} from './vertex-request';

const crossing: Crossing = {
  dialect: 'responses',
  raw: {},
  gatewayName: 'Build',
  virtualModel: 'fast',
  providerModel: 'gemini-2.5-pro',
};

describe('parseVertexCredential', () => {
  test('reads a raw API key', () => {
    expect(parseVertexCredential(' vertex-key ')).toEqual({
      kind: 'api-key',
      apiKey: 'vertex-key',
    });
  });

  test('reads an API key and custom serving base from JSON', () => {
    expect(
      parseVertexCredential('{"api_key":"vertex-key","base_url":"https://vertex.example"}'),
    ).toEqual({ kind: 'api-key', apiKey: 'vertex-key', baseUrl: 'https://vertex.example' });
  });

  test('reads a bearer token with its project and default location', () => {
    expect(
      parseVertexCredential('{"access_token":"vertex-token","project_id":"cloud-project"}'),
    ).toEqual({
      kind: 'bearer',
      accessToken: 'vertex-token',
      projectId: 'cloud-project',
      location: 'us-central1',
    });
  });

  test('rejects incomplete JSON credentials', () => {
    expect(parseVertexCredential('{"access_token":"vertex-token"}')).toBeNull();
  });
});

describe('vertexRequestUrl', () => {
  test('builds the publisher API-key endpoint', () => {
    const credential = parseVertexCredential('vertex-key');

    expect(credential).not.toBeNull();
    if (credential === null) return;

    expect(vertexRequestUrl('https://aiplatform.googleapis.com', credential, crossing)).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:generateContent',
    );
  });

  test('builds the regional project endpoint for a bearer credential', () => {
    const credential = parseVertexCredential(
      '{"access_token":"vertex-token","project_id":"cloud-project","location":"europe-west4"}',
    );

    expect(credential).not.toBeNull();
    if (credential === null) return;

    expect(vertexRequestUrl('https://aiplatform.googleapis.com', credential, crossing)).toBe(
      'https://europe-west4-aiplatform.googleapis.com/v1/projects/cloud-project/locations/europe-west4/publishers/google/models/gemini-2.5-pro:generateContent',
    );
  });

  test('adds SSE selection to a streaming endpoint', () => {
    const credential = parseVertexCredential('vertex-key');

    expect(credential).not.toBeNull();
    if (credential === null) return;

    expect(
      vertexRequestUrl('https://aiplatform.googleapis.com', credential, {
        ...crossing,
        raw: { stream: true },
      }),
    ).toBe(
      'https://aiplatform.googleapis.com/v1/publishers/google/models/gemini-2.5-pro:streamGenerateContent?alt=sse',
    );
  });
});

describe('vertexHeaders', () => {
  test('uses x-goog-api-key for API-key credentials', () => {
    expect(vertexHeaders({ kind: 'api-key', apiKey: 'vertex-key' })).toEqual({
      'x-goog-api-key': 'vertex-key',
    });
  });

  test('uses bearer authorization for project credentials', () => {
    expect(
      vertexHeaders({
        kind: 'bearer',
        accessToken: 'vertex-token',
        projectId: 'cloud-project',
        location: 'global',
      }),
    ).toEqual({ authorization: 'Bearer vertex-token' });
  });
});

describe('stripVertexToolCallIds', () => {
  test('reuses a Responses payload without tool-call IDs', () => {
    const body: JsonObject = {
      contents: [
        {
          role: 'model',
          parts: [{ functionCall: { name: 'lookup', args: { id: 9_007_199_254_740_992 } } }],
        },
      ],
    };

    expect(stripVertexToolCallIds(body, 'responses')).toBe(body);
  });

  test('removes only Vertex-rejected tool-call IDs', () => {
    const body = toolHistory();

    const stripped = stripVertexToolCallIds(body, 'responses');

    expect(stripped).not.toBe(body);
    expect(stripped).toHaveProperty('contents.0.parts.0.functionCall', {
      name: 'lookup',
      args: { id: 9_007_199_254_740_992 },
    });
    expect(stripped).toHaveProperty('contents.1.parts.0.functionResponse', {
      name: 'lookup',
      response: { id: 'keep' },
    });
  });

  test('leaves non-Responses payloads unchanged', () => {
    const body: JsonObject = {
      contents: [{ parts: [{ functionCall: { id: 'call_1', name: 'lookup' } }] }],
    };

    expect(stripVertexToolCallIds(body, 'anthropic')).toBe(body);
  });
});

function toolHistory(): JsonObject {
  return {
    contents: [
      {
        role: 'model',
        parts: [
          {
            functionCall: {
              id: 'call_1',
              name: 'lookup',
              args: { id: 9_007_199_254_740_992 },
            },
          },
        ],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              id: 'call_1',
              name: 'lookup',
              response: { id: 'keep' },
            },
          },
        ],
      },
    ],
  };
}

describe('vertexProviderBody', () => {
  test('removes the gateway session field', () => {
    expect(vertexProviderBody({ contents: [], session_id: 'local' }, crossing)).toEqual({
      contents: [],
    });
  });
});

describe('vertexCountBody', () => {
  test('removes inference-only fields from native token counting', () => {
    expect(
      vertexCountBody({
        contents: [{ role: 'user', parts: [{ text: 'hello' }] }],
        tools: [{ functionDeclarations: [] }],
        generationConfig: { maxOutputTokens: 64 },
        safetySettings: [],
      }),
    ).toEqual({ contents: [{ role: 'user', parts: [{ text: 'hello' }] }] });
  });
});

describe('a Vertex secret that names no credential', () => {
  test.each([
    ['a blank secret', '   '],
    ['an empty secret', ''],
  ])('reads %s as no credential', (_label, secret) => {
    expect(parseVertexCredential(secret)).toBeNull();
  });
});

describe('a Vertex bearer target the operator pinned to their own origin', () => {
  test('keeps the configured origin instead of the regional one', () => {
    const credential = parseVertexCredential(
      '{"access_token":"vertex-token","project":"cloud-project","location":"europe-west4"}',
    );

    expect(
      vertexRequestUrl(
        'https://vertex.internal/',
        credential ?? { kind: 'api-key', apiKey: '' },
        crossing,
      ),
    ).toContain('https://vertex.internal/v1/projects/cloud-project');
  });
});

describe('a Vertex request body the wire did not shape', () => {
  test('a content entry that is not an object survives untouched', () => {
    const body: JsonObject = { contents: ['legacy'] };

    expect(stripVertexToolCallIds(body, 'responses')).toBe(body);
  });

  test('a content without parts survives untouched', () => {
    const body: JsonObject = { contents: [{ role: 'user' }] };

    expect(stripVertexToolCallIds(body, 'responses')).toBe(body);
  });

  test('a part that is not an object survives untouched', () => {
    const body: JsonObject = { contents: [{ role: 'user', parts: ['legacy'] }] };

    expect(stripVertexToolCallIds(body, 'responses')).toBe(body);
  });
});
