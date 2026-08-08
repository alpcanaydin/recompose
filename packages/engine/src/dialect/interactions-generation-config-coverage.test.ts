import { describe, expect, test } from 'vitest';

import {
  providerConfigFromInteractions,
  providerConfigIntoInteractions,
} from './interactions-generation-config';

describe('carrying provider-only generation settings out of an interactions request', () => {
  test('a request with no generation config carries nothing', () => {
    expect(providerConfigFromInteractions({ input: 'hello' })).toEqual({});
  });

  test('settings the hub already models are left behind', () => {
    expect(
      providerConfigFromInteractions({
        input: 'hello',
        generation_config: { temperature: 0.2, top_p: 0.9 },
      }),
    ).toEqual({});
  });

  test('settings the hub cannot model travel as provider config', () => {
    expect(
      providerConfigFromInteractions({
        input: 'hello',
        generation_config: { temperature: 0.2, seed: 7 },
      }),
    ).toEqual({ geminiGenerationConfig: { seed: 7 } });
  });
});

describe('putting provider-only generation settings back into an interactions request', () => {
  test('a hub request without provider config leaves the wire request alone', () => {
    const wire = { input: 'hello' };

    providerConfigIntoInteractions(wire, { messages: [] });

    expect(wire).toEqual({ input: 'hello' });
  });

  test('provider config lands under the generation config', () => {
    const wire = { input: 'hello' };

    providerConfigIntoInteractions(wire, { messages: [], geminiGenerationConfig: { seed: 7 } });

    expect(wire).toEqual({ input: 'hello', generation_config: { seed: 7 } });
  });

  test('settings already on the wire outrank the carried provider config', () => {
    const wire = { input: 'hello', generation_config: { seed: 1 } };

    providerConfigIntoInteractions(wire, { messages: [], geminiGenerationConfig: { seed: 7 } });

    expect(wire).toEqual({ input: 'hello', generation_config: { seed: 1 } });
  });
});
