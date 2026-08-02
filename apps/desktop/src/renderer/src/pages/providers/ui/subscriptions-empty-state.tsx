type SubscriptionsEmptyStateProps = {
  /** Asks for the catalog, which the screen owns because it also holds the drawer. */
  onAddProvider: () => void;
};

/**
 * What stands where the rows would be when no subscription is connected yet.
 *
 * @summary A subscription is the one account kind a person cannot guess the shape of, because it
 * holds no key and reaches no gateway. The sentence says what it is before the act asks for one,
 * and the act stands alone so the screen never asks a person to choose their first move.
 */
export function SubscriptionsEmptyState({ onAddProvider }: SubscriptionsEmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-body text-ink">Nothing connected yet</p>
      <p className="max-w-prose text-caption text-ink-secondary">
        A subscription account is a plan you already pay for, connected by signing in through the
        provider&apos;s own command-line tool. That tool keeps the sign-in and spends the plan, so
        recompose holds no credential for it and no gateway routes through it.
      </p>
      <button className="push-button focus-ring" onClick={onAddProvider} type="button">
        Add provider
      </button>
    </div>
  );
}
