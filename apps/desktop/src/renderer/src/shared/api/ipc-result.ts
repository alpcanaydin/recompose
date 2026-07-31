import type { IpcError } from '@recompose/contracts';

export class IpcResultError extends Error {
  readonly code: IpcError['code'];

  constructor(error: IpcError) {
    super(error.message);
    this.code = error.code;
  }
}

const UNEXPLAINED_REFUSAL = 'recompose gave no reason for refusing.';

/**
 * The sentence a refused request reaches the screen as.
 *
 * @summary The main process writes its refusals for a person to read, so they travel as they
 * stand. A failure that arrived from somewhere else, or carrying nothing, still has to say
 * something, because a control that refuses in silence reads as a broken one.
 */
export function refusalSentence(failure: unknown): string {
  const written = failure instanceof Error ? failure.message : '';

  return written === '' ? UNEXPLAINED_REFUSAL : written;
}

/**
 * A request with the sentence its refusal left behind, ready for the screen to read.
 *
 * @summary Wrap a mutation in it so the control that asked can say why it was refused. The
 * request travels on untouched, so calling it reads the same as it did before.
 */
export function withRefusal<Request extends { error: Error | null }>(
  request: Request,
): Request & { refusal: string | undefined } {
  return {
    ...request,
    refusal: request.error === null ? undefined : refusalSentence(request.error),
  };
}

export function unwrapIpcResult<Value>(
  result: { ok: true; value: Value } | { ok: false; error: IpcError },
): Value {
  if (!result.ok) {
    throw new IpcResultError(result.error);
  }

  return result.value;
}
