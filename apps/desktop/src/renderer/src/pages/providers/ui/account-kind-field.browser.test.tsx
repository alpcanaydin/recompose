import { useState } from 'react';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';

import { AccountKindField } from './account-kind-field';

type Kind = 'api-key' | 'aggregator';

function Harness() {
  const [kind, setKind] = useState<Kind>('api-key');

  return (
    <>
      <AccountKindField onChangeValue={setKind} value={kind} />
      <output>{kind}</output>
    </>
  );
}

test('picking a kind reaches the caller', async () => {
  const screen = await render(<Harness />);

  await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Kind' }), 'aggregator');

  await expect.element(screen.getByRole('status')).toHaveTextContent('aggregator');
});
