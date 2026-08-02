import { KindEmptyState } from './kind-empty-state';

type SubscriptionsEmptyStateProps = {
  /** Asks for the catalog, which the screen owns because it also holds the drawer. */
  onAddProvider: () => void;
};

/**
 * What stands where the rows would be when no subscription is connected yet.
 *
 * @summary A subscription is the one account kind a person cannot guess the shape of, because it
 * holds no key and reaches no gateway, so the shared empty state carries the one act that adds one.
 */
export function SubscriptionsEmptyState({ onAddProvider }: SubscriptionsEmptyStateProps) {
  return (
    <KindEmptyState
      action={
        <button className="push-button-primary focus-ring" onClick={onAddProvider} type="button">
          Add provider
        </button>
      }
      explanation="A subscription account is a plan you already pay for, connected by signing in through the provider's own command-line tool."
      title="Nothing connected yet"
    />
  );
}
