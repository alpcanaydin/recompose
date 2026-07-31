import { Icon } from '../../../shared/ui';
import { GhostGraph } from './ghost-graph';

type EmptyStateProps = {
  /** Asked for when the person takes the invitation to make their first gateway. */
  onCreateGateway: () => void;
};

const GUIDE_URL = 'https://github.com/recomposesh/recompose';

/**
 * The invitation a person meets before any gateway exists.
 *
 * @summary Reach for it on the home surface while the app holds no gateway. It carries the one
 * act worth taking here, so nothing else on it competes for the press.
 */
export function EmptyState({ onCreateGateway }: EmptyStateProps) {
  return (
    <section className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <GhostGraph />
      <h1 className="mb-1.5 text-invitation text-ink">Create your first gateway</h1>
      <p className="mb-4.5 max-w-102.5 text-note leading-normal text-ink-secondary">
        A gateway is one local address that routes requests across your AI accounts. Everything
        stays on this machine.
      </p>
      <div className="flex items-center gap-2.5">
        <button className="push-button-primary focus-ring" onClick={onCreateGateway} type="button">
          <Icon className="size-3.75" name="plus" />
          Create Gateway
        </button>
        <a className="push-button focus-ring" href={GUIDE_URL} rel="noreferrer" target="_blank">
          <Icon className="size-3.75" name="book" />
          Read the guide
        </a>
      </div>
      <span className="mt-3.5 font-mono text-mono-value text-ink-secondary">or press ⌘ N</span>
    </section>
  );
}
