/** What a command-line client sees when it asks a gateway something. */
export type GatewayAnswer = {
  status: number;
  contentType: string;
  body: unknown;
};

async function answerOf(answer: Response): Promise<GatewayAnswer> {
  return {
    status: answer.status,
    contentType: answer.headers.get('content-type') ?? '',
    body: await answer.json(),
  };
}

async function ask(address: string, path: string, method: string): Promise<GatewayAnswer> {
  return answerOf(await fetch(new URL(path, address), { method }));
}

export async function readFrom(address: string, path: string): Promise<GatewayAnswer> {
  return ask(address, path, 'GET');
}

/** The wire body a client sends when it asks a gateway for a turn under a name it holds. */
export function turnUnder(model: string): unknown {
  return {
    model,
    max_tokens: 64,
    messages: [{ role: 'user', content: 'Say hello.' }],
  };
}

/** Sends a real wire body, the way a command-line client asks a gateway for a turn. */
export async function sendTurn(
  address: string,
  path: string,
  body: unknown,
): Promise<GatewayAnswer> {
  return answerOf(
    await fetch(new URL(path, address), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
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

function isFieldBag(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function refusalFields(body: unknown): Record<string, unknown> {
  const error = isObject(body) && 'error' in body ? body.error : undefined;

  if (!isFieldBag(error)) {
    throw new Error(`the answer nests no error object: ${JSON.stringify(body)}`);
  }

  return error;
}

/**
 * The kind an Anthropic client reads a refusal as, which its envelope also marks at the top.
 *
 * @summary The outer marker is read too, because a refusal in another dialect nests an error
 * object of its own and would otherwise answer this reading as though it were Anthropic's.
 */
export function anthropicRefusalType(body: unknown): string {
  const marked = isObject(body) && 'type' in body && body.type === 'error';
  const kind = refusalFields(body)['type'];

  if (!marked || typeof kind !== 'string') {
    throw new Error(`the answer is no Anthropic refusal: ${JSON.stringify(body)}`);
  }

  return kind;
}

/** The code an OpenAI client reads a refusal as, which Anthropic's envelope carries nowhere. */
export function openAiRefusalCode(body: unknown): string {
  const code = refusalFields(body)['code'];

  if (typeof code !== 'string') {
    throw new Error(`the answer is no OpenAI refusal: ${JSON.stringify(body)}`);
  }

  return code;
}

function listingRows(body: unknown): Record<string, unknown>[] {
  const rows = isObject(body) && 'data' in body ? body.data : undefined;

  if (!Array.isArray(rows) || !rows.every(isFieldBag)) {
    throw new Error(`the listing carries no rows: ${JSON.stringify(body)}`);
  }

  return rows;
}

function idsReadingModelsUnder(body: unknown, field: string): string[] {
  return listingRows(body).map((row) => {
    const id = row['id'];

    if (row[field] !== 'model' || typeof id !== 'string') {
      throw new Error(`a listing row reads as no model under "${field}": ${JSON.stringify(row)}`);
    }

    return id;
  });
}

/** The ids an Anthropic client reads, which needs the paging fields standing beside the rows. */
export function anthropicListedIds(body: unknown): string[] {
  if (!isObject(body) || !('has_more' in body) || typeof body.has_more !== 'boolean') {
    throw new Error(`the listing carries no Anthropic paging shape: ${JSON.stringify(body)}`);
  }

  return idsReadingModelsUnder(body, 'type');
}

/** The ids an OpenAI client reads, which needs the list object naming the shape it arrived in. */
export function openAiListedIds(body: unknown): string[] {
  if (!isObject(body) || !('object' in body) || body.object !== 'list') {
    throw new Error(`the listing names no OpenAI list object: ${JSON.stringify(body)}`);
  }

  return idsReadingModelsUnder(body, 'object');
}

/**
 * The names one gateway lists right now, and none while nothing answers its address.
 *
 * @summary A gateway rewritten mid-run is restarted behind the write, so the listing is a state
 * worth waiting on rather than a failure worth throwing.
 */
export async function namesListedAt(address: string): Promise<string[]> {
  try {
    return anthropicListedIds((await readFrom(address, '/v1/models')).body);
  } catch {
    return [];
  }
}
