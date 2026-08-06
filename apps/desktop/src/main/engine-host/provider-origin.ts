import type { CredentialedAccount, LocalAccount } from '@recompose/contracts';

const servingOrigins = new Map<string, string>([
  ['anthropic', 'https://api.anthropic.com'],
  ['openai', 'https://api.openai.com'],
  ['openrouter', 'https://openrouter.ai/api'],
]);

/**
 * Where a target account is spent, or nothing when recompose serves nothing for its provider.
 *
 * @summary A runtime on this machine is spent against the address its row was stored with, so a
 * person who moved it off the documented port is served where it actually listens. A key is spent
 * against the vendor endpoint that speaks Chat Completions, named here rather than borrowed from
 * the engine's probe origins, because a probe asks whether a key authenticates and this says where
 * a turn is served.
 *
 * The lookup is a Map rather than an object, because a stored provider is any non-blank string a
 * person typed and an object would answer `constructor` or `toString` with an inherited member.
 */
export function providerOriginOf(account: CredentialedAccount | LocalAccount): string | undefined {
  return account.kind === 'local' ? account.address : servingOrigins.get(account.provider);
}
