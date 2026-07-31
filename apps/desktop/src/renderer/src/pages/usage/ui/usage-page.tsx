/**
 * What the gateways on this machine have served, and the quiet before any of them has.
 *
 * @summary Reach for it on the usage surface. Nothing routes a request yet, so the screen names
 * the readings it will collect instead of drawing an empty chart that reads as a broken one.
 */
export function UsagePage() {
  return (
    <section className="mx-auto flex w-full max-w-column flex-col gap-5 px-6 pt-page-top pb-6">
      <h1 className="text-title text-ink">Usage</h1>
      <div className="flex flex-col items-center gap-1.5 rounded-card border border-line-subtle bg-surface-card px-6 py-12 text-center">
        <h2 className="text-heading text-ink">No requests yet</h2>
        <p className="max-w-102.5 text-note leading-normal text-ink-secondary">
          Once a gateway serves its first request, its rate, latency, tokens, and spend collect
          here.
        </p>
      </div>
    </section>
  );
}
