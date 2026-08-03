import { type EngineDirective, type GatewayEngineState } from '@recompose/contracts';

import type { EngineChild } from './engine-host';

import { createEngineHost } from './engine-host';

export const running = (): GatewayEngineState => ({ status: 'running' });
export const nothing = (): null => null;

function slugOf(directive: Exclude<EngineDirective, { kind: 'probe' }>): string {
  return directive.kind === 'start' ? directive.gateway.slug : directive.slug;
}

function reportOf(
  directive: Exclude<EngineDirective, { kind: 'probe' }>,
  state: GatewayEngineState,
): unknown {
  return { kind: 'state', answers: directive.id, slug: slugOf(directive), state };
}

function gatewayDirectiveAt(
  directives: EngineDirective[],
  index: number,
): Exclude<EngineDirective, { kind: 'probe' }> {
  const directive = directives[index];

  if (directive === undefined || directive.kind === 'probe') {
    throw new Error(`The scripted child never heard a gateway directive number ${String(index)}.`);
  }

  return directive;
}

export function scriptedChild(answer: () => GatewayEngineState | null) {
  const directives: EngineDirective[] = [];
  const heard: ((message: unknown) => void)[] = [];
  const departed: ((code: number) => void)[] = [];
  let killed = false;

  const send = (report: unknown): void => {
    for (const listener of heard) {
      listener(report);
    }
  };

  const child: EngineChild = {
    postMessage: (directive) => {
      directives.push(directive);

      if (directive.kind === 'probe') {
        return;
      }

      const state = answer();

      if (state !== null) {
        void Promise.resolve().then(() => {
          send(reportOf(directive, state));
        });
      }
    },
    onMessage: (listener) => {
      heard.push(listener);
    },
    onExit: (listener) => {
      departed.push(listener);
    },
    kill: () => {
      killed = true;
    },
  };

  return {
    child,
    directives,
    answerDirective: (index: number, state: GatewayEngineState): void => {
      send(reportOf(gatewayDirectiveAt(directives, index), state));
    },
    wasKilled: () => killed,
    exit: (code: number) => {
      for (const listener of departed) {
        listener(code);
      }
    },
  };
}

export function hostOver(scripted: { child: EngineChild }, knownSlugs: readonly string[] = []) {
  const spawns: number[] = [];

  return {
    spawns,
    host: createEngineHost({
      knownSlugs,
      spawnChild: () => {
        spawns.push(spawns.length);

        return scripted.child;
      },
    }),
  };
}
