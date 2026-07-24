import { net, protocol } from 'electron';
import { pathToFileURL } from 'url';

import { resolveRendererFile } from './renderer-path';

export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true },
    },
  ]);
}

export function serveRenderer(rendererRoot: string): void {
  protocol.handle('app', async (request) => {
    const resolution = resolveRendererFile(rendererRoot, request.url);

    if ('rejected' in resolution) {
      return new Response(null, { status: resolution.rejected === 'traversal' ? 403 : 400 });
    }

    return net.fetch(pathToFileURL(resolution.filePath).toString());
  });
}
