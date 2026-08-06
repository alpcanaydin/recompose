import type { EngineSpendGrant, EngineSpendRequest, SpendGrant } from '@recompose/contracts';

export type SpendGrantFor = (slug: string, virtualModel: string) => Promise<SpendGrant>;

type GrantPort = {
  postMessage: (grant: EngineSpendGrant) => void;
};

async function grantOrNothing(
  grantFor: SpendGrantFor,
  asked: EngineSpendRequest,
): Promise<SpendGrant> {
  try {
    return await grantFor(asked.slug, asked.virtualModel);
  } catch (error) {
    console.error(
      `recompose could not resolve a grant for "${asked.virtualModel}" on the gateway "${asked.slug}", so the turn is refused.`,
      error,
    );

    return { verdict: 'missing-target' };
  }
}

/**
 * Answers one child request to spend a virtual model's target.
 *
 * @summary Every request draws an answer, including the ones nothing can be granted for, because a
 * child left waiting holds an open turn. The credential a resolved grant carries lives in this
 * call's scope and in the message it posts, so nothing longer-lived ever holds it.
 */
export function answerSpendRequest(
  port: GrantPort,
  grantFor: SpendGrantFor,
  asked: EngineSpendRequest,
): void {
  void grantOrNothing(grantFor, asked).then((grant) => {
    port.postMessage({ kind: 'spend-grant', answers: asked.id, grant });
  });
}
