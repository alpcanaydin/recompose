import type { ResponsesStreamItem } from './responses-wire';

export type ResponsesBlockState = {
  skipped: Set<number>;
  open: Set<number>;
  closed: Set<number>;
  images: Map<string, string>;
  pending: Map<number, ResponsesStreamItem>;
  arguments: Map<number, string>;
};

export function newResponsesBlockState(): ResponsesBlockState {
  return {
    skipped: new Set(),
    open: new Set(),
    closed: new Set(),
    images: new Map(),
    pending: new Map(),
    arguments: new Map(),
  };
}
