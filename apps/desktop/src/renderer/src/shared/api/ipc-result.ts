import type { IpcError } from '@recompose/contracts';

export class IpcResultError extends Error {
  readonly code: IpcError['code'];

  constructor(error: IpcError) {
    super(error.message);
    this.code = error.code;
  }
}

export function unwrapIpcResult<Value>(
  result: { ok: true; value: Value } | { ok: false; error: IpcError },
): Value {
  if (!result.ok) {
    throw new IpcResultError(result.error);
  }

  return result.value;
}
