import { KindEmptyState } from '../kind-empty-state/kind-empty-state';

/**
 * What stands where the rows would be when no subscription is connected yet.
 *
 * @summary A subscription is the one account kind a person cannot guess the shape of, because it
 * holds no key and reaches no gateway, so one sentence says what it is. The act lives in the
 * window strip, so the state explains rather than asks.
 */
export function SubscriptionsEmptyState() {
  return (
    <KindEmptyState
      explanation="A subscription account is a plan you already pay for, connected by signing in through the provider's own command-line tool."
      title="Nothing connected yet"
    />
  );
}
