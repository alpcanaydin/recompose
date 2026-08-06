import { isJsonObject, parsedJson } from '../gateway-wire';

function responsePayload(text: string): string {
  const parsed = parsedJson(text);
  const response = isJsonObject(parsed) ? parsed['response'] : undefined;

  return isJsonObject(response) ? JSON.stringify(response) : text;
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

export async function unwrapAntigravityResponse(response: Response): Promise<Response> {
  const headers = new Headers(response.headers);

  headers.delete('content-length');

  if (headers.get('content-type')?.includes('text/event-stream') === true) {
    return new Response(response.body === null ? null : unwrappedStream(response.body), {
      status: response.status,
      headers,
    });
  }

  const text = await response.text();

  return new Response(responsePayload(text), { status: response.status, headers });
}
