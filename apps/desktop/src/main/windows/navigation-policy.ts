export type NavigationPolicy = { devServerOrigin: string | undefined };

const APP_SCHEME = 'app:';
const APP_HOST = 'renderer';

export function isAllowedNavigation(targetUrl: string, policy: NavigationPolicy): boolean {
  if (!URL.canParse(targetUrl)) {
    return false;
  }

  const url = new URL(targetUrl);

  if (url.protocol === APP_SCHEME && url.host === APP_HOST) {
    return true;
  }

  return policy.devServerOrigin !== undefined && url.origin === policy.devServerOrigin;
}

export type ExternalOpenDecision = 'open-https' | 'drop';

export function decideExternalOpen(targetUrl: string): ExternalOpenDecision {
  if (!URL.canParse(targetUrl)) {
    return 'drop';
  }

  return new URL(targetUrl).protocol === 'https:' ? 'open-https' : 'drop';
}
