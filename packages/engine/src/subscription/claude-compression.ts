import { Readable } from 'node:stream';
import {
  createBrotliDecompress,
  createGunzip,
  createInflate,
  createZstdDecompress,
} from 'node:zlib';

type PeekedBody = {
  prefix: Uint8Array;
  body: ReadableStream<Uint8Array>;
};

function joined(chunks: Uint8Array[]): Uint8Array {
  const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const output = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

async function peekBody(body: ReadableStream<Uint8Array>): Promise<PeekedBody> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (size < 4) {
    const step = await reader.read();

    if (step.done) {
      break;
    }

    chunks.push(step.value);
    size += step.value.byteLength;
  }

  const prefix = joined(chunks);
  const restored = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
    },
    async pull(controller) {
      const step = await reader.read();

      if (step.done) {
        controller.close();
      } else {
        controller.enqueue(step.value);
      }
    },
    async cancel(reason) {
      await reader.cancel(reason);
    },
  });

  return { prefix, body: restored };
}

function startsWithBytes(value: Uint8Array, prefix: number[]): boolean {
  return prefix.every((byte, index) => value[index] === byte);
}

function magicEncoding(prefix: Uint8Array): string | null {
  if (startsWithBytes(prefix, [0x1f, 0x8b])) {
    return 'gzip';
  }

  return startsWithBytes(prefix, [0x28, 0xb5, 0x2f, 0xfd]) ? 'zstd' : null;
}

function advertisedEncodings(header: string | null): string[] {
  return header === null
    ? []
    : header
        .split(',')
        .map((encoding) => encoding.trim().toLowerCase())
        .filter((encoding) => encoding !== '' && encoding !== 'identity');
}

function decoderFor(encoding: string) {
  switch (encoding) {
    case 'gzip':
      return createGunzip();
    case 'deflate':
      return createInflate();
    case 'br':
      return createBrotliDecompress();
    case 'zstd':
      return createZstdDecompress();
    default:
      throw new Error(`unsupported Claude response content encoding: ${encoding}`);
  }
}

function decodedBy(body: ReadableStream<Uint8Array>, encoding: string): ReadableStream<Uint8Array> {
  const decoded = Readable.fromWeb(body).pipe(decoderFor(encoding));

  return Readable.toWeb(decoded);
}

function decodedBody(
  body: ReadableStream<Uint8Array>,
  encodings: string[],
): ReadableStream<Uint8Array> {
  return encodings.reduceRight(decodedBy, body);
}

function responseInit(response: Response): ResponseInit {
  const headers = new Headers(response.headers);

  headers.delete('content-encoding');
  headers.delete('content-length');

  return { status: response.status, statusText: response.statusText, headers };
}

export async function decodeClaudeResponse(response: Response): Promise<Response> {
  if (response.body === null) {
    return response;
  }

  const peeked = await peekBody(response.body);
  const advertised = advertisedEncodings(response.headers.get('content-encoding'));
  const magic = magicEncoding(peeked.prefix);
  const encodings = advertised.length > 0 ? advertised : magic === null ? [] : [magic];
  const body = encodings.length === 0 ? peeked.body : decodedBody(peeked.body, encodings);

  return new Response(body, responseInit(response));
}
