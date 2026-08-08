import type { RecomposeIpc } from '@recompose/contracts';

/** The model ids each account answers a look with, keyed by the account's stored id. */
export type SeededModelLists = Record<string, readonly string[]>;

export const noModelLists: SeededModelLists = {};

export type ModelListHandlers = Pick<RecomposeIpc, 'accounts:list-models'>;

/**
 * The model-list half of the fake bridge, standing in for the lane that reaches a provider.
 *
 * @summary A scenario names the accounts whose lists are readable this run, so an account it never
 * named answers the same unlisted standing a silent provider does. The wire carries no sentence,
 * exactly as main's does, so the refusal a person reads is the one the renderer owns rather than
 * one the fake invented.
 */
export function modelListHandlers(seeded: SeededModelLists): ModelListHandlers {
  return {
    'accounts:list-models': async ({ id }) => {
      const listed = seeded[id];

      return Promise.resolve(
        listed === undefined
          ? { ok: true, value: { standing: 'unlisted' } }
          : { ok: true, value: { standing: 'listed', modelIds: [...listed] } },
      );
    },
  };
}
