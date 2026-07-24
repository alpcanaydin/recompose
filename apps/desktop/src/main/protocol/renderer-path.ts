import { resolve, sep } from 'path';

export type RendererFileResolution =
  | { filePath: string }
  | { rejected: 'not-app-scheme' | 'traversal' };

const APP_SCHEME = 'app:';
const APP_HOST = 'renderer';

function isValidAppUrl(protocol: string, host: string): boolean {
  return protocol === APP_SCHEME && host === APP_HOST;
}

const TRAVERSAL_PATTERN = /\.\.|\\|%2[eE]%2[eE]/;

function isTraversalAttempt(path: string): boolean {
  return TRAVERSAL_PATTERN.test(path);
}

function isPathInRoot(filePath: string, root: string): boolean {
  return filePath.startsWith(root + sep);
}

export function resolveRendererFile(
  rendererRoot: string,
  requestUrl: string,
): RendererFileResolution {
  if (isTraversalAttempt(requestUrl)) {
    return { rejected: 'traversal' };
  }

  const url = new URL(requestUrl);

  if (!isValidAppUrl(url.protocol, url.host)) {
    return { rejected: 'not-app-scheme' };
  }

  const requestedPath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const relativePath = requestedPath === '' ? 'index.html' : requestedPath;
  const root = resolve(rendererRoot);
  const filePath = resolve(root, relativePath);

  return isPathInRoot(filePath, root) ? { filePath } : { rejected: 'traversal' };
}
