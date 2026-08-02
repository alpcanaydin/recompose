import { KindEmptyState } from './kind-empty-state';

/**
 * What the fourth destination holds while the surface behind it is still being built.
 *
 * @summary The sidebar counts four kinds because the contract holds four, so the destination
 * exists before anything can be connected to it. A sentence naming what will stand here reads as
 * a plan, where a blank screen reads as a fault, and the window strip still offers the catalog the
 * other kinds add through.
 */
export function LocalRuntimesNote() {
  return (
    <KindEmptyState
      explanation="A local runtime serves a model from this machine rather than from a provider. Nothing connects here yet, and this destination fills in once recompose can run one."
      title="Local runtimes arrive later"
    />
  );
}
