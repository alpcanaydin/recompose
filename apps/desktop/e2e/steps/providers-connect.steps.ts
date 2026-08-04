import { expect } from '@playwright/test';

import { Then, When } from '../fixtures';
import {
  accountRow,
  accountRows,
  catalog,
  connectKey,
  fillKeyForm,
  keyBody,
  keyEndingIn,
  keyField,
  nameField,
  pickEntry,
  submitConnect,
} from '../provider-screen';
import {
  rememberKeyEntry,
  rememberVault,
  rememberWarning,
  vaultBeforeTheRefusal,
  warningTheSurfaceShowed,
} from '../scenario-memory';
import { vaultBytes } from '../vault-file';

const NAME_A_SCENARIO_TYPES = 'build';

const KEY_HOLDING_A_CONTROL_CHARACTER = 'sk-not-a-real\tkey-7f2c';

const KEY_A_REFUSED_CONNECT_PASTES_ENDS_IN = '9a11';

const TAIL_A_SCENARIO_EXPECTS = '7f2c';

When('the maintainer picks {string} in the catalog', async ({ page }, entry: string) => {
  rememberKeyEntry(page, entry);
  await pickEntry(page, entry);
});

When(
  'the maintainer connects another {string} key named {string}',
  async ({ electronApp, page }, entry: string, name: string) => {
    rememberVault(page, await vaultBytes(electronApp));
    await connectKey(page, {
      entry,
      name,
      pasted: keyEndingIn(entry, KEY_A_REFUSED_CONNECT_PASTES_ENDS_IN),
    });
  },
);

When(
  'the maintainer connects an {string} key ending in {string} followed by a newline',
  async ({ page }, entry: string, tail: string) => {
    rememberKeyEntry(page, entry);
    await connectKey(page, {
      entry,
      name: NAME_A_SCENARIO_TYPES,
      pasted: `${keyEndingIn(entry, tail)}\n`,
    });
  },
);

When(
  'the maintainer connects an {string} key holding a control character inside it',
  async ({ page }, entry: string) => {
    rememberKeyEntry(page, entry);
    await connectKey(page, {
      entry,
      name: NAME_A_SCENARIO_TYPES,
      pasted: KEY_HOLDING_A_CONTROL_CHARACTER,
    });
  },
);

When(
  'the maintainer connects a key beginning {string} under the {string} entry',
  async ({ page }, opening: string, entry: string) => {
    rememberKeyEntry(page, entry);
    await fillKeyForm(page, {
      entry,
      name: NAME_A_SCENARIO_TYPES,
      pasted: `${opening}api03-${keyBody}${TAIL_A_SCENARIO_EXPECTS}`,
    });
    rememberWarning(page, await catalog(page).getByRole('status').innerText());
    await submitConnect(page);
  },
);

Then('the form asks for a name and a key', async ({ page }) => {
  await expect(nameField(page)).toBeVisible();
  await expect(keyField(page)).toBeVisible();
});

Then('no field asks for a provider, a base URL, or a dialect', async ({ page }) => {
  await expect(catalog(page).getByLabel('Provider')).toHaveCount(0);
  await expect(catalog(page).getByLabel('Base URL')).toHaveCount(0);
  await expect(catalog(page).getByLabel('Dialect')).toHaveCount(0);
});

Then('the surface names {string} as the host the key reaches', async ({ page }, host: string) => {
  await expect(catalog(page)).toContainText(host);
});

Then('the connect is refused, naming the holder of {string}', async ({ page }, name: string) => {
  await expect(catalog(page).getByRole('alert')).toContainText(name);
  await expect(catalog(page)).toBeVisible();
});

Then('the vault holds nothing for the refused key', async ({ electronApp, page }) => {
  expect(await vaultBytes(electronApp)).toBe(vaultBeforeTheRefusal(page));
});

Then(
  'two rows named {string} stand, one under {string} and one under {string}',
  async ({ page }, name: string, first: string, second: string) => {
    const rows = accountRow(page, name);

    await expect(rows).toHaveCount(2);
    await expect(rows.filter({ hasText: first })).toHaveCount(1);
    await expect(rows.filter({ hasText: second })).toHaveCount(1);
  },
);

Then('the masked tail reads {string}', async ({ page }, tail: string) => {
  await expect(accountRows(page).first().getByText(`••••${tail}`, { exact: true })).toBeVisible();
});

Then('the connect is refused', async ({ page }) => {
  await expect(catalog(page).getByRole('alert')).toBeVisible();
  await expect(keyField(page)).toBeVisible();
});

Then("the refusal speaks of the key's contents, never of its shape", async ({ page }) => {
  const refusal = catalog(page).getByRole('alert');

  await expect(refusal).toContainText('control character');
  await expect(refusal).not.toContainText('shape');
});

Then("a warning says the key's shape suggests another vendor", ({ page }) => {
  expect(warningTheSurfaceShowed(page)).toContain('shape suggests Anthropic rather than OpenAI');
});
