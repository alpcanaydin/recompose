type SubscriptionsEmptyStateProps = {
  /** Asks for the catalog, which the screen owns because it also holds the drawer. */
  onAddProvider: () => void;
};

/**
 * What stands where the rows would be when no subscription is connected yet.
 *
 * @summary A subscription is the one account kind a person cannot guess the shape of, because it
 * holds no key and reaches no gateway. One sentence says what it is before the act asks for one,
 * and the act stands alone so the screen never asks a person to choose their first move. The
 * state carries no border, because a dashed edge around an act reads as a place to drop
 * something, and nothing on this screen is ever dropped.
 */
export function SubscriptionsEmptyState({ onAddProvider }: SubscriptionsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2.5 px-6 py-10 text-center">
      <h2 className="text-heading text-ink">Nothing connected yet</h2>
      <p className="max-w-prose text-body text-ink-secondary">
        A subscription account is a plan you already pay for, connected by signing in through the
        provider&apos;s own command-line tool.
      </p>
      <button className="mt-1 push-button-primary focus-ring" onClick={onAddProvider} type="button">
        Add provider
      </button>
    </div>
  );
}
