export type TrustedSender = {
  frameUrl: string | null;
  isMainFrame: boolean;
};

export type AllowedOrigins = {
  devServerOrigin: string | undefined;
};

function isTrustedOrigin(frameUrl: string, allowed: AllowedOrigins): boolean {
  const parsedUrl = new URL(frameUrl);

  if (parsedUrl.protocol === 'file:') {
    return true;
  }

  return allowed.devServerOrigin !== undefined && parsedUrl.origin === allowed.devServerOrigin;
}

export function assertTrustedSender(sender: TrustedSender, allowed: AllowedOrigins): void {
  const trusted =
    sender.frameUrl !== null && sender.isMainFrame && isTrustedOrigin(sender.frameUrl, allowed);

  if (!trusted) {
    throw new Error('untrusted ipc sender');
  }
}
