import { isJsonObject, parsedJson } from '../gateway-wire';

function responsePayload(text: string): string {
  const parsed = parsedJson(text);
  const response = isJsonObject(parsed) ? parsed['response'] : undefined;

  return isJsonObject(response) ? JSON.stringify(response) : text;
}

function vertexGroundingRedirect(value: unknown): value is string {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);

    return (
      url.protocol === 'https:' &&
      url.hostname === 'vertexaisearch.cloud.google.com' &&
      url.pathname.startsWith('/grounding-api-redirect/')
    );
  } catch {
    return false;
  }
}

async function resolvedGroundingURL(uri: string, fetchLike: typeof fetch): Promise<string> {
  try {
    const answer = await fetchLike(uri, { method: 'HEAD', redirect: 'manual' });
    const location = answer.headers.get('location');

    return answer.status >= 300 && answer.status < 400 && location !== null
      ? new URL(location, uri).href
      : uri;
  } catch {
    return uri;
  }
}

async function resolveGroundingChunk(chunk: unknown, fetchLike: typeof fetch): Promise<unknown> {
  if (!isJsonObject(chunk) || !isJsonObject(chunk['web'])) return chunk;

  const uri = chunk['web']['uri'];

  if (!vertexGroundingRedirect(uri)) return chunk;

  return { ...chunk, web: { ...chunk['web'], uri: await resolvedGroundingURL(uri, fetchLike) } };
}

async function resolveGroundingMetadata(candidate: unknown, fetchLike: typeof fetch) {
  if (!isJsonObject(candidate) || !isJsonObject(candidate['groundingMetadata'])) return candidate;

  const chunks = candidate['groundingMetadata']['groundingChunks'];

  if (!Array.isArray(chunks)) return candidate;

  return {
    ...candidate,
    groundingMetadata: {
      ...candidate['groundingMetadata'],
      groundingChunks: await Promise.all(
        chunks.map(async (chunk) => {
          const resolved = await resolveGroundingChunk(chunk, fetchLike);

          return resolved;
        }),
      ),
    },
  };
}

async function resolvedResponsePayload(text: string, fetchLike: typeof fetch): Promise<string> {
  const parsed = parsedJson(text);
  const response = isJsonObject(parsed) ? parsed['response'] : undefined;

  if (!isJsonObject(response) || !Array.isArray(response['candidates']))
    return responsePayload(text);

  return JSON.stringify({
    ...response,
    candidates: await Promise.all(
      response['candidates'].map(async (candidate) => {
        const resolved = await resolveGroundingMetadata(candidate, fetchLike);

        return resolved;
      }),
    ),
  });
}

function unwrapLine(line: string): string {
  if (!line.startsWith('data:')) {
    return line;
  }

  const payload = line.slice(5).trimStart();

  return `data: ${responsePayload(payload)}`;
}

function unwrappedStream(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  let buffered = '';
  const decoded = body.pipeThrough(new TextDecoderStream());
  const lines = decoded.pipeThrough(
    new TransformStream<string, string>({
      transform(chunk, controller) {
        buffered += chunk;
        const complete = buffered.split('\n');

        buffered = complete.pop() ?? '';

        for (const line of complete) controller.enqueue(`${unwrapLine(line)}\n`);
      },
      flush(controller) {
        if (buffered !== '') controller.enqueue(unwrapLine(buffered));
      },
    }),
  );

  return lines.pipeThrough(new TextEncoderStream());
}

export async function unwrapAntigravityResponse(
  response: Response,
  fetchLike: typeof fetch = globalThis.fetch,
): Promise<Response> {
  const headers = new Headers(response.headers);

  headers.delete('content-length');

  if (headers.get('content-type')?.includes('text/event-stream') === true) {
    return new Response(response.body === null ? null : unwrappedStream(response.body), {
      status: response.status,
      headers,
    });
  }

  const text = await response.text();

  return new Response(await resolvedResponsePayload(text, fetchLike), {
    status: response.status,
    headers,
  });
}
