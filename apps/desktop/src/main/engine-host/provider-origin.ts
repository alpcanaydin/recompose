import type { Account } from '@recompose/contracts';

const servingOrigins = new Map<string, string>([
  ['aistudio', 'https://generativelanguage.googleapis.com'],
  ['anthropic', 'https://api.anthropic.com'],
  ['openai', 'https://api.openai.com'],
  ['gemini', 'https://generativelanguage.googleapis.com'],
  ['kimi', 'https://api.kimi.com/coding'],
  ['openrouter', 'https://openrouter.ai/api'],
  ['vertex', 'https://aiplatform.googleapis.com'],
  ['xai', 'https://api.x.ai/v1'],
]);

const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The origin named in the environment to stand in for every vendor, where one names a machine.
 *
 * @summary A scenario driving the whole app has to spend a stored key somewhere it can watch, and
 * the engine child already honors a probe origin on the same terms. Anything naming a host off this
 * machine is refused rather than honored, so a variable a person did not set cannot quietly send
 * their credential somewhere else.
 */
function standInOrigin(): string | undefined {
  const named = process.env['RECOMPOSE_SERVING_ORIGIN'];

  if (named === undefined) {
    return undefined;
  }

  if (URL.canParse(named) && loopbackHosts.has(new URL(named).hostname)) {
    return named;
  }

  console.error('recompose ignored a serving origin, because it does not name a loopback host.');

  return undefined;
}

/**
 * Where a target account is spent, or nothing when recompose serves nothing for its provider.
 *
 * @summary A runtime on this machine is spent against the address its row was stored with, so a
 * person who moved it off the documented port is served where it actually listens. A key is spent
 * against the vendor endpoint that speaks Chat Completions, named here rather than borrowed from
 * the engine's probe origins, because a probe asks whether a key authenticates and this says where
 * a turn is served. A provider the table serves nothing for stays unserved whatever the environment
 * says, because the stand-in redirects a vendor rather than inventing one.
 *
 * The lookup is a Map rather than an object, because a stored provider is any non-blank string a
 * person typed and an object would answer `constructor` or `toString` with an inherited member.
 */
export function providerOriginOf(account: Account): string | undefined {
  if (account.kind === 'local') {
    return account.address;
  }

  return subscriptionOriginOf(account) ?? keyedOriginOf(account.provider);
}

function subscriptionOriginOf(account: Account): string | undefined {
  if (account.kind !== 'subscription') {
    return undefined;
  }

  const origins = new Map([
    ['anthropic', 'https://api.anthropic.com'],
    ['openai', 'https://chatgpt.com/backend-api/codex'],
    ['antigravity', 'https://daily-cloudcode-pa.googleapis.com'],
  ]);
  const origin = origins.get(account.provider);

  return origin === undefined ? undefined : (standInOrigin() ?? origin);
}

function keyedOriginOf(provider: string): string | undefined {
  const served = servingOrigins.get(provider);

  return served === undefined ? undefined : (standInOrigin() ?? served);
}
