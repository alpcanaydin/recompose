export type TrustedSender = {
  frameUrl: string | null;
  isMainFrame: boolean;
};

export type AllowedOrigins = {
  devServerOrigin: string | undefined;
};

const APP_SCHEME = 'app:';
const APP_HOST = 'renderer';

function isTrustedOrigin(frameUrl: string, allowed: AllowedOrigins): boolean {
  const url = new URL(frameUrl);

  if (url.protocol === APP_SCHEME && url.host === APP_HOST) {
    return true;
  }

  return allowed.devServerOrigin !== undefined && url.origin === allowed.devServerOrigin;
}

export function assertTrustedSender(sender: TrustedSender, allowed: AllowedOrigins): void {
  const trusted =
    sender.frameUrl !== null && sender.isMainFrame && isTrustedOrigin(sender.frameUrl, allowed);

  if (!trusted) {
    throw new Error('untrusted ipc sender');
  }
}
