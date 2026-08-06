import {
  type EngineDirective,
  engineDirectiveSchema,
  engineReportSchema,
  engineSpendGrantSchema,
  engineSpendRequestSchema,
  type KeyProviderId,
  type SpendGrant,
} from '@recompose/contracts';

import type { SpendGrantFor } from './gateway-app';
import type { ParentPort } from './parent-port';

import { createEngineRuntime, type EngineRuntime, type OpenListeners } from './engine-runtime';
import { firstPartyProbeOrigins, probeKey } from './provider/key-probe';
import { listProviderModels } from './provider/model-list';
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

type LookDirective = Extract<EngineDirective, { kind: 'probe' | 'probe-runtime' | 'list-models' }>;

async function lookAnswerFor(fetchLike: typeof fetch, directive: LookDirective): Promise<unknown> {
  switch (directive.kind) {
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
    case 'list-models':
      return {
        kind: 'model-list',
        answers: directive.id,
        listing: await listProviderModels(fetchLike, directive.origin, directive.custody),
      };

    default: {
      const unknownLook: never = directive;

      throw new Error(
        `the engine child heard a look kind it does not know: ${kindOf(unknownLook)}`,
      );
    }
  }
}

async function answerFor(
  runtime: EngineRuntime,
  fetchLike: typeof fetch,
  directive: EngineDirective,
): Promise<unknown> {
  if (directive.kind === 'start') {
    return {
      kind: 'state',
      answers: directive.id,
      slug: directive.gateway.slug,
      state: await runtime.start(directive.gateway),
    };
  }

  if (directive.kind === 'stop') {
    return {
      kind: 'state',
      answers: directive.id,
      slug: directive.slug,
      state: await runtime.stop(directive.slug),
    };
  }

  return lookAnswerFor(fetchLike, directive);
}

async function reportBack(
  parentPort: ParentPort,
  runtime: EngineRuntime,
  fetchLike: typeof fetch,
  directive: EngineDirective,
): Promise<void> {
  parentPort.postMessage(engineReportSchema.parse(await answerFor(runtime, fetchLike, directive)));
}

type SpendLane = {
  grantFor: SpendGrantFor;
  settle: (data: unknown) => boolean;
};

function openSpendLane(parentPort: ParentPort): SpendLane {
  const pending = new Map<string, (grant: SpendGrant) => void>();

  return {
    grantFor: async (slug, virtualModel) =>
      new Promise((resolve) => {
        const id = crypto.randomUUID();

        pending.set(id, resolve);
        parentPort.postMessage(
          engineSpendRequestSchema.parse({ kind: 'spend-request', id, slug, virtualModel }),
        );
      }),
    settle: (data) => {
      const answer = engineSpendGrantSchema.safeParse(data);

      if (!answer.success) {
        return false;
      }

      const resolve = pending.get(answer.data.answers);

      if (resolve === undefined) {
        console.error('The engine child heard a spend grant answering no open request.');

        return true;
      }

      pending.delete(answer.data.answers);
      resolve(answer.data.grant);

      return true;
    },
  };
}

export function attachEngineChild(
  parentPort: ParentPort,
  openListeners: OpenListeners,
  fetchLike: typeof fetch = globalThis.fetch,
): void {
  const spendLane = openSpendLane(parentPort);
  const runtime = createEngineRuntime(openListeners, spendLane.grantFor, fetchLike);

  parentPort.on('message', (messageEvent) => {
    if (spendLane.settle(messageEvent.data)) {
      return;
    }

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
