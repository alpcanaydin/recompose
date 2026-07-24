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

function decodedPathname(rawPath: string): string | null {
  try {
    return decodeURIComponent(rawPath).replace(/^\/+/, '');
  } catch {
    return null;
  }
}

function resolveFilePath(rendererRoot: string, relativePath: string): string | null {
  const root = resolve(rendererRoot);
  const filePath = resolve(root, relativePath);

  if (!filePath.startsWith(root + sep)) {
    return null;
  }

  return filePath;
}

function validateRequestPath(rendererRoot: string, requestUrl: string): string | null {
  const rawPath = extractPathFromUrl(requestUrl);
  const requestedPath = decodedPathname(rawPath);

  if (requestedPath === null) {
    return null;
  }

  const relativePath = requestedPath === '' ? 'index.html' : requestedPath;

  return resolveFilePath(rendererRoot, relativePath);
}

export function resolveRendererFile(
  rendererRoot: string,
  requestUrl: string,
): RendererFileResolution {
  const url = new URL(requestUrl);

  if (url.protocol !== APP_SCHEME || url.host !== APP_HOST) {
    return { rejected: 'not-app-scheme' };
  }

  const filePath = validateRequestPath(rendererRoot, requestUrl);

  if (filePath === null) {
    return { rejected: 'traversal' };
  }

  return { filePath };
}
