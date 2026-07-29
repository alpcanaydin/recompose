/**
 * What a page shows when its data could not be read.
 *
 * @summary Hand it to a route's errorComponent so the failure stays inside the outlet and the
 * navigation around it survives, which is the only way back to the page that repairs the file.
 */
export function PageError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3" role="alert">
      <h1 className="text-title text-ink">This page could not be read</h1>
      <p className="text-body text-ink-secondary">{error.message}</p>
      <button className="push-button" onClick={reset} type="button">
        Try again
      </button>
    </div>
  );
}
