import {
  type EngineDirective,
  type EngineSpendGrant,
  type GatewayEngineState,
  type KeyCheckReport,
  type ModelListing,
  type RuntimeReachability,
} from '@recompose/contracts';

import type { EngineChild } from './engine-host';
import type { SpendGrantFor } from './engine-spend';

import { createEngineHost } from './engine-host';

export const running = (): GatewayEngineState => ({ status: 'running' });
export const nothing = (): null => null;

function slugOf(directive: Extract<EngineDirective, { kind: 'start' | 'stop' }>): string {
  return directive.kind === 'start' ? directive.gateway.slug : directive.slug;
}

function reportOf(
  directive: Extract<EngineDirective, { kind: 'start' | 'stop' }>,
  state: GatewayEngineState,
): unknown {
  return { kind: 'state', answers: directive.id, slug: slugOf(directive), state };
}

function gatewayDirectiveAt(
  directives: EngineDirective[],
  index: number,
): Extract<EngineDirective, { kind: 'start' | 'stop' }> {
  const directive = directives[index];

  if (directive === undefined || (directive.kind !== 'start' && directive.kind !== 'stop')) {
    throw new Error(`The scripted child never heard a gateway directive number ${String(index)}.`);
  }

  return directive;
}

type Script = {
  send: (report: unknown) => void;
  answer: () => GatewayEngineState | null;
  answerProbe: () => KeyCheckReport | null;
  answerRuntime: () => RuntimeReachability | null;
  answerModelList: () => ModelListing | null;
};

function keyCheckFor(
  script: Script,
  directive: Extract<EngineDirective, { kind: 'probe' }>,
): unknown {
  const report = script.answerProbe();

  return report === null ? null : { kind: 'key-check', answers: directive.id, ...report };
}

function runtimeCheckFor(
  script: Script,
  directive: Extract<EngineDirective, { kind: 'probe-runtime' }>,
): unknown {
  const reachability = script.answerRuntime();

  return reachability === null
    ? null
    : { kind: 'runtime-check', answers: directive.id, reachability };
}

function stateFor(
  script: Script,
  directive: Extract<EngineDirective, { kind: 'start' | 'stop' }>,
): unknown {
  const state = script.answer();

  return state === null ? null : reportOf(directive, state);
}

function modelListFor(
  script: Script,
  directive: Extract<EngineDirective, { kind: 'list-models' }>,
): unknown {
  const listing = script.answerModelList();

  return listing === null ? null : { kind: 'model-list', answers: directive.id, listing };
}

function reportFor(script: Script, directive: EngineDirective): unknown {
  if (directive.kind === 'probe') {
    return keyCheckFor(script, directive);
  }

  if (directive.kind === 'probe-runtime') {
    return runtimeCheckFor(script, directive);
  }

  if (directive.kind === 'list-models') {
    return modelListFor(script, directive);
  }

  return stateFor(script, directive);
}

function answerLater(script: Script, directive: EngineDirective): void {
  const report = reportFor(script, directive);

  if (report !== null) {
    void Promise.resolve().then(() => {
      script.send(report);
    });
  }
}

type Lane = {
  directives: EngineDirective[];
  grants: EngineSpendGrant[];
};

function recordAndAnswer(
  lane: Lane,
  script: Script,
  message: EngineDirective | EngineSpendGrant,
): void {
  if (message.kind === 'spend-grant') {
    lane.grants.push(message);

    return;
  }

  lane.directives.push(message);
  answerLater(script, message);
}

export function scriptedChild(
  answer: () => GatewayEngineState | null,
  answerProbe: () => KeyCheckReport | null = () => null,
  answerRuntime: () => RuntimeReachability | null = () => null,
  answerModelList: () => ModelListing | null = () => null,
) {
  const lane: Lane = { directives: [], grants: [] };
  const { directives, grants } = lane;
  const heard: ((message: unknown) => void)[] = [];
  const departed: ((code: number) => void)[] = [];
  let killed = false;

  const send = (report: unknown): void => {
    for (const listener of heard) {
      listener(report);
    }
  };

  const script: Script = { send, answer, answerProbe, answerRuntime, answerModelList };

  const child: EngineChild = {
    postMessage: (message) => {
      recordAndAnswer(lane, script, message);
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
    grants,
    send,
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

export const grantsNothing: SpendGrantFor = async () =>
  Promise.resolve({ verdict: 'missing-target' });

export function hostOver(
  scripted: { child: EngineChild },
  knownSlugs: readonly string[] = [],
  grantFor: SpendGrantFor = grantsNothing,
) {
  const spawns: number[] = [];

  return {
    spawns,
    host: createEngineHost({
      knownSlugs,
      grantFor,
      spawnChild: () => {
        spawns.push(spawns.length);

        return scripted.child;
      },
    }),
  };
}
