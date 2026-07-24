import { resolve, sep } from 'path';

export type RendererFileResolution =
  | { filePath: string }
  | { rejected: 'not-app-scheme' | 'traversal' };

const APP_SCHEME = 'app:';
const APP_HOST = 'renderer';
const URL_PATH_REGEX = /^app:\/\/[^/]*(.*)/;

function extractPathFromUrl(requestUrl: string): string {
  const pathMatch = URL_PATH_REGEX.exec(requestUrl);

  return pathMatch?.[1] ?? '/';
}

export function resolveRendererFile(
  rendererRoot: string,
  requestUrl: string,
): RendererFileResolution {
  const url = new URL(requestUrl);

  if (url.protocol !== APP_SCHEME || url.host !== APP_HOST) {
    return { rejected: 'not-app-scheme' };
  }

  const rawPath = extractPathFromUrl(requestUrl);
  const requestedPath = decodeURIComponent(rawPath).replace(/^\/+/, '');
  const relativePath = requestedPath === '' ? 'index.html' : requestedPath;

  const root = resolve(rendererRoot);
  const filePath = resolve(root, relativePath);

  if (!filePath.startsWith(root + sep)) {
    return { rejected: 'traversal' };
  }

  return { filePath };
}
