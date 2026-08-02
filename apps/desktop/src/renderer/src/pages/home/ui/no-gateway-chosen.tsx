/**
 * The surface a person meets when gateways exist but the one they last opened has gone.
 *
 * @summary Reach for it on the home surface while gateways are stored. A launch opens the last
 * gateway, so arriving here means that one has gone, and the way on is a sidebar row rather than
 * anything on this surface. Saying so is what keeps the surface from reading as a dead end.
 */
export function NoGatewayChosen() {
  return (
    <section className="absolute inset-0 flex flex-col items-center justify-center text-center">
      <h1 className="mb-1.5 text-invitation text-ink">Pick a gateway</h1>
      <p className="max-w-102.5 text-body leading-normal text-ink-secondary">
        Choose one from the sidebar to see it.
      </p>
    </section>
  );
}
