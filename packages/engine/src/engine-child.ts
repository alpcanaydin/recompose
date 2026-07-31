import {
  type EngineDirective,
  engineDirectiveSchema,
  engineReportSchema,
} from '@recompose/contracts';

import type { ParentPort } from './parent-port';

import { createEngineRuntime, type EngineRuntime, type OpenListeners } from './engine-runtime';

async function reportBack(
  parentPort: ParentPort,
  runtime: EngineRuntime,
  directive: EngineDirective,
): Promise<void> {
  const report =
    directive.kind === 'start'
      ? {
          kind: 'state',
          answers: directive.id,
          slug: directive.gateway.slug,
          state: await runtime.start(directive.gateway),
        }
      : {
          kind: 'state',
          answers: directive.id,
          slug: directive.slug,
          state: await runtime.stop(directive.slug),
        };

  parentPort.postMessage(engineReportSchema.parse(report));
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
