import {
  type EngineDirective,
  engineDirectiveSchema,
  engineReportSchema,
  type KeyProviderId,
} from '@recompose/contracts';

import type { ParentPort } from './parent-port';

import { createEngineRuntime, type EngineRuntime, type OpenListeners } from './engine-runtime';
import { firstPartyProbeOrigins, probeKey } from './provider/key-probe';
import { probeRuntime } from './provider/runtime-probe';

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

function loopbackOverrideOrNull(variable: string, override: string | undefined): string | null {
  if (override === undefined) {
    return null;
  }

  if (URL.canParse(override) && loopbackHosts.has(new URL(override).hostname)) {
    return override;
  }

  console.error(`The engine child ignored ${variable}, because it does not name a loopback host.`);

  return null;
}

function probeOriginFor(provider: KeyProviderId): string {
  return (
    loopbackOverrideOrNull('RECOMPOSE_PROBE_ORIGIN', process.env['RECOMPOSE_PROBE_ORIGIN']) ??
    firstPartyProbeOrigins[provider]
  );
}

function runtimeOriginFor(address: string): string {
  return (
    loopbackOverrideOrNull('RECOMPOSE_RUNTIME_ORIGIN', process.env['RECOMPOSE_RUNTIME_ORIGIN']) ??
    address
  );
}

function kindOf(directive: { kind: string }): string {
  return directive.kind;
}

type RefusalIssue = { path: readonly PropertyKey[]; code: string };

function sanitizedRefusal(issues: readonly RefusalIssue[]): { path: string; code: string }[] {
  return issues.map((issue) => ({
    path: issue.path.map((segment) => String(segment)).join('.'),
    code: issue.code,
  }));
}

async function answerFor(
  runtime: EngineRuntime,
  fetchLike: typeof fetch,
  directive: EngineDirective,
): Promise<unknown> {
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
      return {
        kind: 'key-check',
        answers: directive.id,
        ...(await probeKey(
          fetchLike,
          directive.provider,
          directive.key,
          probeOriginFor(directive.provider),
        )),
      };

    case 'probe-runtime':
      return {
        kind: 'runtime-check',
        answers: directive.id,
        reachability: await probeRuntime(fetchLike, runtimeOriginFor(directive.address)),
      };

    default: {
      const unknownDirective: never = directive;

      throw new Error(
        `the engine child heard a directive kind it does not know: ${kindOf(unknownDirective)}`,
      );
    }
  }
}

async function reportBack(
  parentPort: ParentPort,
  runtime: EngineRuntime,
  fetchLike: typeof fetch,
  directive: EngineDirective,
): Promise<void> {
  parentPort.postMessage(engineReportSchema.parse(await answerFor(runtime, fetchLike, directive)));
}

export function attachEngineChild(
  parentPort: ParentPort,
  openListeners: OpenListeners,
  fetchLike: typeof fetch = globalThis.fetch,
): void {
  const runtime = createEngineRuntime(openListeners);

  parentPort.on('message', (messageEvent) => {
    const directive = engineDirectiveSchema.safeParse(messageEvent.data);

    if (!directive.success) {
      console.error(
        'The engine child refused a directive it could not read.',
        sanitizedRefusal(directive.error.issues),
      );

      return;
    }

    reportBack(parentPort, runtime, fetchLike, directive.data).catch((failure: unknown) => {
      console.error('The engine child could not answer a directive.', failure);
    });
  });
}
