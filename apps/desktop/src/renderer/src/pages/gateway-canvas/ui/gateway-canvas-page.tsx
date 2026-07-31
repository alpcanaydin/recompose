/** The surface a selected gateway composes on, dotted the way a canvas reads. */
export function GatewayCanvasPage({ slug }: { slug: string }) {
  return (
    <section className="h-full p-6 dot-grid">
      <h1 className="text-ink-secondary">{slug}</h1>
      <p>Canvas coming soon.</p>
    </section>
  );
}
