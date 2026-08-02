import { KindEmptyState } from './kind-empty-state';

type LocalRuntimesNoteProps = {
  /** Asks for the catalog, which the page owns because it also holds the drawer. */
  onAddProvider: () => void;
};

/**
 * What the fourth destination holds while the surface behind it is still being built.
 *
 * @summary The sidebar counts four kinds because the contract holds four, so the destination
 * exists before anything can be connected to it. A sentence naming what will stand here reads as
 * a plan, where a blank screen reads as a fault, and the act opens the same catalog every other
 * kind adds through.
 */
export function LocalRuntimesNote({ onAddProvider }: LocalRuntimesNoteProps) {
  return (
    <KindEmptyState
      action={
        <button className="push-button-primary focus-ring" onClick={onAddProvider} type="button">
          Add provider
        </button>
      }
      explanation="A local runtime serves a model from this machine rather than from a provider. Nothing connects here yet, and this destination fills in once recompose can run one."
      title="Local runtimes arrive later"
    />
  );
}
