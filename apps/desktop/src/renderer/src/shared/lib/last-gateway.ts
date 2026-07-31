const LAST_GATEWAY_KEY = 'recompose.gateways.last';

/** Records the gateway now on screen, so the next launch opens where this one left off. */
export function lookedAtGateway(slug: string): void {
  localStorage.setItem(LAST_GATEWAY_KEY, slug);
}

/**
 * The gateway a launch should open, given the ones that still exist.
 *
 * @summary A remembered gateway that has since gone reads as no memory at all, which lands the
 * launch on the invitation rather than on a slug nothing answers to.
 */
export function rememberedGateway(knownSlugs: readonly string[]): string | undefined {
  const remembered = localStorage.getItem(LAST_GATEWAY_KEY);

  if (remembered === null || !knownSlugs.includes(remembered)) {
    return undefined;
  }

  return remembered;
}
