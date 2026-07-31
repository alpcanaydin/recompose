/** What a command-line client sees when it asks a gateway something. */
export type GatewayAnswer = {
  status: number;
  contentType: string;
  body: unknown;
};

async function ask(address: string, path: string, method: string): Promise<GatewayAnswer> {
  const answer = await fetch(new URL(path, address), { method });

  return {
    status: answer.status,
    contentType: answer.headers.get('content-type') ?? '',
    body: await answer.json(),
  };
}

export async function readFrom(address: string, path: string): Promise<GatewayAnswer> {
  return ask(address, path, 'GET');
}

export async function postTo(address: string, path: string): Promise<GatewayAnswer> {
  return ask(address, path, 'POST');
}

export function addressOfPort(port: number): string {
  return `http://localhost:${String(port)}`;
}

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function namesAGateway(body: unknown): body is { gateway: string } {
  return isObject(body) && 'gateway' in body && typeof body.gateway === 'string';
}

function carriesMessage(value: unknown): value is { message: string } {
  return isObject(value) && 'message' in value && typeof value.message === 'string';
}

function carriesRefusal(body: unknown): body is { error: { message: string } } {
  return isObject(body) && 'error' in body && carriesMessage(body.error);
}

/** The gateway a health answer names, which is the display name rather than the slug. */
export function namedGateway(body: unknown): string {
  if (!namesAGateway(body)) {
    throw new Error(`the answer names no gateway: ${JSON.stringify(body)}`);
  }

  return body.gateway;
}

/**
 * The gateway serving this address, and nothing when nothing serves it.
 *
 * @summary A stopped gateway refuses the connection outright, so the absent answer is a state
 * worth reading rather than a failure worth throwing.
 */
export async function healthNameAt(address: string): Promise<string | null> {
  try {
    const answer = await readFrom(address, '/health');

    return answer.status === 200 ? namedGateway(answer.body) : null;
  } catch {
    return null;
  }
}

/** The sentence a refusal carries, which both dialects nest under an error object. */
export function refusalSentence(body: unknown): string {
  if (!carriesRefusal(body)) {
    throw new Error(`the answer carries no typed refusal: ${JSON.stringify(body)}`);
  }

  return body.error.message;
}
