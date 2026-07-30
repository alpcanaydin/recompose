import { expect } from '@playwright/test';

import { Given, Then } from '../fixtures';
import { healthNameAt } from '../gateway-client';
import { openGateway, portFieldValue, shownAddress } from '../gateway-screen';
import { rememberTakenPort } from '../scenario-memory';

Given('another process has taken the offered port', async ({ page, portSquatter }) => {
  const offered = Number(await portFieldValue(page));

  await portSquatter.take(offered);
  rememberTakenPort(page, offered);
});

Then('{string} answers at the address the toolbar shows', async ({ page }, name: string) => {
  await openGateway(page, name);

  expect(await healthNameAt(await shownAddress(page))).toBe(name);
});
