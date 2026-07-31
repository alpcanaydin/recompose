import { describe, expect, test } from 'vitest';

import { getStartedSteps } from './get-started-steps';

const titles = [
  'Create a gateway',
  'Connect a provider',
  'Compose a virtual model',
  'Send the first request',
];

const everyProgress = [true, false].flatMap((gatewayExists) =>
  [true, false].map((providerConnected) => ({ gatewayExists, providerConnected })),
);

describe('the checklist a first session follows', () => {
  test('it names the same four steps in the same order, whatever the session has done', () => {
    expect(
      getStartedSteps({ gatewayExists: false, providerConnected: false }).map((step) => step.title),
    ).toEqual(titles);
    expect(
      getStartedSteps({ gatewayExists: true, providerConnected: true }).map((step) => step.title),
    ).toEqual(titles);
  });

  test('a session that has done nothing stands on the first step', () => {
    const [gateway, provider] = getStartedSteps({
      gatewayExists: false,
      providerConnected: false,
    });

    expect(gateway).toMatchObject({ title: 'Create a gateway', state: 'current' });
    expect(provider).toMatchObject({ title: 'Connect a provider', state: 'pending' });
  });

  test('a stored gateway completes the first step and moves the session to the second', () => {
    const [gateway, provider] = getStartedSteps({
      gatewayExists: true,
      providerConnected: false,
    });

    expect(gateway).toMatchObject({ state: 'done' });
    expect(provider).toMatchObject({ state: 'current' });
  });

  test('a connected account completes the provider step on its own', () => {
    const [gateway, provider] = getStartedSteps({
      gatewayExists: false,
      providerConnected: true,
    });

    expect(gateway).toMatchObject({ state: 'current' });
    expect(provider).toMatchObject({ state: 'done' });
  });

  test('the two steps this build cannot finish name what they wait for', () => {
    const [, , compose, request] = getStartedSteps({
      gatewayExists: true,
      providerConnected: true,
    });

    expect(compose).toEqual({
      title: 'Compose a virtual model',
      state: 'pending',
      reason: 'Waits on the canvas.',
    });
    expect(request).toEqual({
      title: 'Send the first request',
      state: 'pending',
      reason: 'Waits on a virtual model.',
    });
  });
});

describe('the invariants the checklist keeps whatever the session has done', () => {
  test('a step the session can act on carries no waiting reason', () => {
    const acting = getStartedSteps({ gatewayExists: false, providerConnected: false }).slice(0, 2);

    expect(acting.every((step) => step.reason === undefined)).toBe(true);
  });

  test('it never marks two steps current at once', () => {
    for (const progress of everyProgress) {
      const current = getStartedSteps(progress).filter((step) => step.state === 'current');

      expect(current.length).toBeLessThanOrEqual(1);
    }
  });
});
