import type { Page } from '@playwright/test';
import type { GatewayConfig, VirtualModel } from '@recompose/contracts';

import { expect } from '@playwright/test';

import { addressOfPort, namesListedAt } from './gateway-client';
import { gatewayRow, storedGateway } from './gateway-screen';

/** A definition binding one virtual name to one stored account and one real model. */
export function bindingOf(id: string, accountId: string, providerModel: string): VirtualModel {
  return { id, displayName: id, target: { accountId, providerModel } };
}

export type StoreOutcome = { ok: true } | { ok: false; message: string };

/** Hands a whole gateway document to the write lane the drawer uses, and answers what it said. */
export async function offerVirtualModels(
  page: Page,
  gateway: string,
  models: readonly VirtualModel[],
): Promise<StoreOutcome> {
  const stored = await storedGateway(page, gateway);
  const rewritten: GatewayConfig = { ...stored, virtualModels: [...models] };
  const answer = await page.evaluate(
    async (config) => window.recompose['gateways:update'](config),
    rewritten,
  );

  return answer.ok ? { ok: true } : { ok: false, message: answer.error.message };
}

/**
 * Puts definitions on a stored gateway without walking the drawer, and waits for them to serve.
 *
 * @summary A scenario that starts from a gateway already serving a name is describing where it
 * starts rather than what it proves, so the arrangement takes the write lane the drawer takes and
 * then waits for the listing to name what landed, because the gateway restarts behind the write and
 * a turn sent into the snapshot it held before would read as the app refusing a name it holds.
 */
export async function seedVirtualModels(
  page: Page,
  gateway: string,
  models: readonly VirtualModel[],
): Promise<void> {
  const { port } = await storedGateway(page, gateway);
  const outcome = await offerVirtualModels(page, gateway, models);

  if (!outcome.ok) {
    throw new Error(`the app stored no definition on "${gateway}": ${outcome.message}`);
  }

  await expect
    .poll(async () => namesListedAt(addressOfPort(port)))
    .toEqual(models.map((model) => model.id));
  await page.reload();
  await expect(gatewayRow(page, gateway)).toBeVisible();
}
