import { subscriptionProviders, type SubscriptionProviderId } from '@recompose/contracts';

export type SignInCommandRequest = {
  provider: SubscriptionProviderId;
  home: string;
  platform: NodeJS.Platform;
};

export type ShellSetupLineRequest = {
  provider: SubscriptionProviderId;
  pointer: string;
  platform: NodeJS.Platform;
};

function invocation(provider: SubscriptionProviderId): string {
  const { toolBinary, signInArguments } = subscriptionProviders[provider];

  return [toolBinary, ...signInArguments].join(' ');
}

export function signInCommandFor(request: SignInCommandRequest): string {
  const variable = subscriptionProviders[request.provider].configHomeVariable;
  const tool = invocation(request.provider);

  return request.platform === 'win32'
    ? `$env:${variable}="${request.home}"; ${tool}`
    : `${variable}="${request.home}" ${tool}`;
}

export function shellSetupLineFor(request: ShellSetupLineRequest): string {
  const variable = subscriptionProviders[request.provider].configHomeVariable;

  return request.platform === 'win32'
    ? `$env:${variable}="${request.pointer}"`
    : `export ${variable}="$(readlink -f "${request.pointer}")"`;
}
