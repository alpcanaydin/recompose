import { expect, test } from 'vitest';

import { gatewaySeed, installFakeBridge } from './fake-bridge';

async function saving(gateway: ReturnType<typeof gatewaySeed>) {
  return window.recompose['gateways:save'](gateway);
}

async function storedGateways() {
  const answer = await window.recompose['gateways:list']();

  return answer.ok ? answer.value : [];
}

test('a gateway with no name is refused, the way the real boundary refuses it', async () => {
  installFakeBridge();

  const answer = await saving(gatewaySeed({ slug: 'codex', displayName: '', port: 51234 }));

  expect(answer.ok ? 'stored' : answer.error.code).toBe('validation-failed');
  expect(await storedGateways()).toEqual([]);
});

test('a port outside what a gateway can bind is refused the same way', async () => {
  installFakeBridge();

  const answer = await saving(gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 80 }));

  expect(answer.ok ? 'stored' : answer.error.code).toBe('validation-failed');
  expect(await storedGateways()).toEqual([]);
});

test('a gateway the contract accepts still stores', async () => {
  installFakeBridge();

  const answer = await saving(gatewaySeed({ slug: 'codex', displayName: 'Codex', port: 51234 }));

  expect(answer.ok).toBe(true);
  expect(await storedGateways()).toMatchObject([{ slug: 'codex', port: 51234 }]);
});
