import { randomUUID } from 'node:crypto';

export const CPA_TRACE_HEADER = 'x-cpa-trace-id';

export function formatCPATraceID(selectedAt: Date, authIndex: string, requestId: string): string {
  if (!Number.isFinite(selectedAt.getTime())) return '';
  if (authIndex.trim() === '' || requestId.trim() === '') return '';

  const timestamp = selectedAt.toISOString().replace(/[-:T]/gu, '').slice(0, 14);

  return `${timestamp}-${authIndex}-${requestId}`;
}

export class CPATraceCommit {
  readonly #requestId: string;
  #trace = '';
  #committed = false;

  public constructor(requestId: string = randomUUID()) {
    this.#requestId = requestId;
  }

  public select(authIndex: string, selectedAt = new Date()): void {
    if (this.#committed) return;

    this.#trace = formatCPATraceID(selectedAt, authIndex, this.#requestId);
  }

  public commit(headers: Headers): void {
    if (this.#committed) return;

    this.#committed = true;
    if (this.#trace !== '') headers.set(CPA_TRACE_HEADER, this.#trace);
  }

  public requestId(): string {
    return this.#requestId;
  }
}
