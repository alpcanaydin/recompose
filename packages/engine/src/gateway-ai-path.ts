import { randomUUID } from 'node:crypto';

const publicApi = /^\/(?:openai\/)?v(?:1(?:beta|alpha)?|1)(?:\/|$)/u;
const codexApi = /^\/backend-api\/codex(?:\/|$)/u;

export function isAIAPIPath(path: string): boolean {
  return publicApi.test(path) || codexApi.test(path);
}

export function requestIdForAIPath(path: string, existing?: string): string | undefined {
  if (!isAIAPIPath(path)) return undefined;

  return existing?.trim() === '' || existing === undefined ? randomUUID() : existing;
}
