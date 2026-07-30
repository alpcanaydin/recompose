export type GatewayOrder = <Answer>(slug: string, work: () => Promise<Answer>) => Promise<Answer>;

/**
 * Runs one gateway's directives one turn at a time.
 *
 * @summary The engine child handles directives concurrently, so a start and a stop naming the
 * same gateway would race inside it. Directives naming different gateways still overlap.
 */
export function createGatewayOrder(): GatewayOrder {
  const turnBySlug = new Map<string, Promise<unknown>>();

  return async (slug, work) => {
    const answered = (turnBySlug.get(slug) ?? Promise.resolve()).then(work, work);

    turnBySlug.set(
      slug,
      answered.then(
        () => undefined,
        () => undefined,
      ),
    );

    return answered;
  };
}
