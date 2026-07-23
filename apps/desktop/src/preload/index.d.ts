import type { RecomposeIpc } from '@recompose/contracts';

declare global {
  interface Window {
    recompose: RecomposeIpc;
  }
}

export {};
