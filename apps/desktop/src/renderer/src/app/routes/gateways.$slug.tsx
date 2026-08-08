import { gatewaySlugSchema } from '@recompose/contracts';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { useEffect } from 'react';

import { GatewayCanvasPage } from '../../pages/gateway-canvas';
import { lookedAtGateway } from '../../shared/lib';

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
  remountDeps: ({ params }) => params.slug,
  component: GatewayCanvasRoute,
});

function GatewayCanvasRoute() {
  const { slug } = Route.useParams();

  useEffect(() => {
    lookedAtGateway(slug);
  }, [slug]);

  return <GatewayCanvasPage slug={slug} />;
}
