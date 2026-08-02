/**
 * What the fourth destination holds while the surface behind it is still being built.
 *
 * @summary The sidebar counts four kinds because the contract holds four, so the destination
 * exists before anything can be connected to it. A sentence naming what will stand here reads as
 * a plan, where a blank screen reads as a fault.
 */
export function LocalRuntimesNote() {
  return (
    <div className="flex flex-col gap-2 rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
      <p className="text-body text-ink">Local runtimes arrive later</p>
      <p className="mx-auto max-w-prose text-caption text-ink-secondary">
        A local runtime serves a model from this machine rather than from a provider. Nothing
        connects here yet, and this destination fills in once recompose can run one.
      </p>
    </div>
  );
}
