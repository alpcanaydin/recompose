import {
  type EngineDirective,
  engineDirectiveSchema,
  engineReportSchema,
} from '@recompose/contracts';

import type { ParentPort } from './parent-port';

import { createEngineRuntime, type EngineRuntime, type OpenListeners } from './engine-runtime';

function keyCheckNoProbeCanAnswerYet(answers: string): unknown {
  return { kind: 'key-check', answers, verdict: 'could-not-check' };
}

async function answerFor(runtime: EngineRuntime, directive: EngineDirective): Promise<unknown> {
  switch (directive.kind) {
    case 'start':
      return {
        kind: 'state',
        answers: directive.id,
        slug: directive.gateway.slug,
        state: await runtime.start(directive.gateway),
      };
    case 'stop':
      return {
        kind: 'state',
        answers: directive.id,
        slug: directive.slug,
        state: await runtime.stop(directive.slug),
      };
    case 'probe':
      return keyCheckNoProbeCanAnswerYet(directive.id);

    default: {
      const unknownDirective: never = directive;

      throw new Error(
        `the engine child heard a directive kind it does not know: ${typeof unknownDirective}`,
      );
    }
  }
}

async function reportBack(
  parentPort: ParentPort,
  runtime: EngineRuntime,
  directive: EngineDirective,
): Promise<void> {
  parentPort.postMessage(engineReportSchema.parse(await answerFor(runtime, directive)));
}

export function attachEngineChild(parentPort: ParentPort, openListeners: OpenListeners): void {
  const runtime = createEngineRuntime(openListeners);

  parentPort.on('message', (messageEvent) => {
    const directive = engineDirectiveSchema.safeParse(messageEvent.data);

    if (!directive.success) {
      console.error(
        'The engine child refused a directive it could not read.',
        directive.error.issues,
      );

      return;
    }

    reportBack(parentPort, runtime, directive.data).catch((failure: unknown) => {
      console.error('The engine child could not answer a directive.', failure);
    });
  });
}
