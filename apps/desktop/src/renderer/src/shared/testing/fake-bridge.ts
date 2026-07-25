import type { AccountsDocument, RecomposeIpc } from '@recompose/contracts';

const emptyDocument: AccountsDocument = { schemaVersion: 1, accounts: [] };

export type BridgeParameters = {
  accounts?: AccountsDocument;
  overrides?: Partial<RecomposeIpc>;
};

export function installFakeBridge(parameters: BridgeParameters = {}): void {
  let registry = parameters.accounts ?? emptyDocument;
  let nextAccountNumber = registry.accounts.length + 1;

  window.recompose = {
    'gateways:list': async () => Promise.resolve({ ok: true, value: [] }),
    'gateways:save': async () => Promise.resolve({ ok: true, value: [] }),
    'settings:get': async () =>
      Promise.resolve({
        ok: true,
        value: { schemaVersion: 1, theme: 'system', enginePort: 8397 },
      }),
    'settings:save': async (settings) => Promise.resolve({ ok: true, value: settings }),
    'accounts:list': async () => Promise.resolve({ ok: true, value: registry }),
    'accounts:connect': async (request) => {
      const id = `a${nextAccountNumber}`;

      nextAccountNumber += 1;

      registry = {
        ...registry,
        accounts: [
          ...registry.accounts,
          {
            id,
            provider: request.provider,
            kind: request.kind,
            label: request.label,
            credentialRef: `c-${id}`,
          },
        ],
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    'accounts:remove': async (request) => {
      registry = {
        ...registry,
        accounts: registry.accounts.filter((row) => row.id !== request.id),
      };

      return Promise.resolve({ ok: true, value: registry });
    },
    ...parameters.overrides,
  };
}
