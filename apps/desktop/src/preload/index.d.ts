import type { RecomposeIpc, RecomposeIpcEvents } from '@recompose/contracts';

declare global {
  interface Window {
    recompose: RecomposeIpc;
    recomposeEvents: RecomposeIpcEvents;
  }
}

export {};
