import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  codexModelCatalogSnapshot,
  fetchCodexModelCatalog,
  loadCodexModelCatalog,
  refreshCodexModelCatalog,
  validateCodexModelCatalog,
} from './codex-model-catalog';

const original = codexModelCatalogSnapshot().data;

afterEach(() => {
  loadCodexModelCatalog(original);
});

function catalog(slug = 'gpt-5.5', description = 'Default model'): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify({
      models: [
        {
          slug,
          display_name: slug,
          description,
          context_window: 400_000,
          max_output_tokens: 128_000,
          default_reasoning_level: 'medium',
          supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }],
          base_instructions: 'You are Codex.',
          priority: 1,
        },
      ],
    }),
  );
}

describe('revisioned Codex model catalog parity', () => {
  test('TestEmbeddedCodexClientModelsCatalogIsValid', () => {
    const first = codexModelCatalogSnapshot();

    expect(first.revision).toBeGreaterThan(0);
    expect(() => validateCodexModelCatalog(first.data)).not.toThrow();
    first.data[0] = 0;
    expect(() => validateCodexModelCatalog(codexModelCatalogSnapshot().data)).not.toThrow();
  });

  test('TestValidateCodexClientModelsJSON', () => {
    expect(() => validateCodexModelCatalog(catalog())).not.toThrow();

    for (const invalid of [new Uint8Array(), new TextEncoder().encode('{"models":[]}')]) {
      expect(() => validateCodexModelCatalog(invalid)).toThrow();
    }
  });

  test('TestLoadCodexClientModelsRejectsInvalidWithoutReplacing', () => {
    loadCodexModelCatalog(catalog('gpt-5.5', 'valid snapshot'));
    const before = codexModelCatalogSnapshot();

    expect(() => loadCodexModelCatalog(new TextEncoder().encode('{"models":[]}'))).toThrow();
    expect(codexModelCatalogSnapshot()).toEqual(before);
  });

  test('TestFetchCodexClientModelsFallsBackToNextURL', async () => {
    const valid = catalog();
    const fetchLike = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ models: [] }))
      .mockResolvedValueOnce(new Response(valid));

    await expect(fetchCodexModelCatalog(fetchLike, ['one', 'two'])).resolves.toEqual(valid);
    expect(fetchLike).toHaveBeenCalledTimes(2);
  });

  test('TestRefreshCodexClientModelsKeepsLastValidSnapshot', async () => {
    loadCodexModelCatalog(catalog('gpt-5.5', 'last valid'));
    const before = codexModelCatalogSnapshot();
    const fetchLike = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ models: [] }));

    await expect(refreshCodexModelCatalog(fetchLike, ['invalid'])).resolves.toBe(false);
    expect(codexModelCatalogSnapshot()).toEqual(before);
  });
});
