import { GhostGraph } from './ghost-graph';

type EmptyStateProps = {
  /** Asked for when the person takes the invitation to make their first gateway. */
  onCreateGateway: () => void;
};

/**
 * The invitation a person meets before any gateway exists.
 *
 * @summary Reach for it on the home surface while the app holds no gateway. It carries the one
 * act worth taking here, so nothing else on it competes for the press.
 */
export function EmptyState({ onCreateGateway }: EmptyStateProps) {
  return (
    <section className="mx-auto flex max-w-column flex-col items-center gap-4 pt-12 text-center">
      <GhostGraph />
      <h1 className="text-heading text-ink">Create your first gateway</h1>
      <p className="max-w-102.5 text-body text-ink-secondary">
        A gateway is one local address that routes requests across your AI accounts. Everything
        stays on this machine.
      </p>
      <button className="push-button-primary" onClick={onCreateGateway} type="button">
        Create Gateway
      </button>
    </section>
  );
}
