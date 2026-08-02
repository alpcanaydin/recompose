import type {
  IpcChannel,
  RecomposeIpc,
  SubscriptionAccountView,
  SubscriptionTool,
} from '@recompose/contracts';

import { subscriptionProviders } from '@recompose/contracts';

export type SubscriptionHandlers = Pick<
  RecomposeIpc,
  Extract<IpcChannel, `subscriptions:${string}`>
>;

export const noSubscriptions: readonly SubscriptionAccountView[] = [];
export const noTools: readonly SubscriptionTool[] = [];

/**
 * The subscription half of the fake bridge, answering every act with the list it left behind.
 *
 * @summary The real channels each answer with the whole view list, because the pointer that says
 * which account is active moves outside the renderer. These answers keep that shape, so a screen
 * reading them never learns to re-ask.
 */
export function subscriptionHandlers(
  seededViews: readonly SubscriptionAccountView[],
  seededTools: readonly SubscriptionTool[],
  onAccountLanded?: (id: string, provider: SubscriptionAccountView['provider']) => void,
): SubscriptionHandlers {
  let held = [...seededViews];
  let nextSubscriptionNumber = held.length + 1;

  const asHeld = async () => Promise.resolve({ ok: true as const, value: held });

  return {
    'subscriptions:list': asHeld,
    'subscriptions:tools': async () => Promise.resolve({ ok: true, value: [...seededTools] }),
    'subscriptions:sign-in': async ({ provider }) => {
      const id = `s${nextSubscriptionNumber}`;

      nextSubscriptionNumber += 1;
      onAccountLanded?.(id, provider);
      held = [
        ...held,
        {
          id,
          provider,
          label: subscriptionProviders[provider].toolName,
          standing: 'connected',
          active: held.length === 0,
        },
      ];

      return asHeld();
    },
    'subscriptions:restore': async ({ id }) => {
      held = held.map((view) => (view.id === id ? { ...view, standing: 'connected' } : view));

      return asHeld();
    },
    'subscriptions:activate': async ({ id }) => {
      held = held.map((view) => ({ ...view, active: view.id === id }));

      return asHeld();
    },
  };
}
