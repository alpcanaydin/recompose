import { KindEmptyState } from '../kind-empty-state/kind-empty-state';

const emptyExplanation: Record<'api-key' | 'aggregator', string> = {
  'api-key':
    "An API key is a secret one provider gives you, and a gateway spends it request by request against that provider's own endpoint.",
  aggregator:
    'An aggregator key is a single secret that reaches many providers through one endpoint, so a gateway can route across them all.',
};

type CredentialedEmptyStateProps = {
  /** Which kind of credential the empty screen would list. */
  kind: 'api-key' | 'aggregator';
};

/** What stands where the rows would be when no key or aggregator account is connected yet. */
export function CredentialedEmptyState({ kind }: CredentialedEmptyStateProps) {
  return <KindEmptyState explanation={emptyExplanation[kind]} title="Nothing connected yet" />;
}
