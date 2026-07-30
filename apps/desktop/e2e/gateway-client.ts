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

function isObject(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function namesAGateway(body: unknown): body is { gateway: string } {
  return isObject(body) && 'gateway' in body && typeof body.gateway === 'string';
}

/** The gateway a health answer names, which is the display name rather than the slug. */
export function namedGateway(body: unknown): string {
  if (!namesAGateway(body)) {
    throw new Error(`the answer names no gateway: ${JSON.stringify(body)}`);
  }

  return body.gateway;
}
