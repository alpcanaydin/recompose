import { gatewaySlugSchema } from '@recompose/contracts';
import { createFileRoute, notFound } from '@tanstack/react-router';

import { GatewayCanvasPage } from '../../pages/gateway-canvas';

function parseSlug(rawSlug: string) {
  const result = gatewaySlugSchema.safeParse(rawSlug);

  if (!result.success) throw notFound();

  return { slug: result.data };
}

export const Route = createFileRoute('/gateways/$slug')({
  params: {
    parse: (params) => parseSlug(params.slug),
    stringify: (params) => params,
  },
  component: GatewayCanvasRoute,
});

function GatewayCanvasRoute() {
  const { slug } = Route.useParams();

  return <GatewayCanvasPage slug={slug} />;
}
