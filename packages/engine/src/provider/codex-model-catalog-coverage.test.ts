import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
  codexModelCatalogSnapshot,
  fetchCodexModelCatalog,
  loadCodexModelCatalog,
  refreshCodexModelCatalog,
  validateCodexModelCatalog,
} from './codex-model-catalog';

type CatalogModel = Record<string, unknown>;

function aModel(overrides: CatalogModel = {}): CatalogModel {
  return {
    slug: 'gpt-5.5',
    display_name: 'GPT-5.5',
    description: 'Default Codex model.',
    context_window: 400_000,
    max_output_tokens: 128_000,
    default_reasoning_level: 'medium',
    supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }],
    base_instructions: 'You are Codex.',
    priority: 1,
    ...overrides,
  };
}

function encoded(models: readonly unknown[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ models }));
}

function fetchServing(bodies: readonly (Uint8Array | Error)[]): typeof fetch {
  const queue = [...bodies];

  return async (): Promise<Response> => {
    const next = queue.shift();

    await Promise.resolve();

    if (next === undefined || next instanceof Error) {
      throw next ?? new Error('no source left to answer');
    }

    return new Response(next);
  };
}

const malformedModels: [string, CatalogModel][] = [
  ['a blank display name', aModel({ display_name: '' })],
  ['a description that is not text', aModel({ description: 42 })],
  ['a context window that is not a number', aModel({ context_window: 'four hundred thousand' })],
  ['a priority that arrives as null', aModel({ priority: null })],
  ['a default level no supported level answers', aModel({ default_reasoning_level: 'ultra' })],
  ['supported reasoning levels that are not a list', aModel({ supported_reasoning_levels: {} })],
];

describe('the fields a Codex model must spell before the catalog is accepted', () => {
  test.each(malformedModels)('a catalog carrying %s is refused', (_name, model) => {
    expect(() => validateCodexModelCatalog(encoded([model]))).toThrow(
      'invalid Codex model catalog fields',
    );
  });

  test('a models list holding something that is not a model at all is refused', () => {
    expect(() => validateCodexModelCatalog(encoded(['gpt-5.5']))).toThrow(
      'invalid Codex model catalog fields',
    );
  });
});

describe('the identity a well-formed Codex catalog must still satisfy', () => {
  test('a catalog naming the same slug twice is refused on identity', () => {
    expect(() => validateCodexModelCatalog(encoded([aModel(), aModel()]))).toThrow(
      'invalid Codex model catalog identity',
    );
  });

  test('a catalog without the default gpt-5.5 model is refused on identity', () => {
    const catalog = encoded([aModel({ slug: 'gpt-5.9', display_name: 'GPT-5.9' })]);

    expect(() => validateCodexModelCatalog(catalog)).toThrow(
      'invalid Codex model catalog identity',
    );
  });

  test('two distinct slugs including gpt-5.5 pass identity', () => {
    const catalog = encoded([aModel(), aModel({ slug: 'gpt-5.6-luna', display_name: 'Luna' })]);

    expect(validateCodexModelCatalog(catalog).models).toHaveLength(2);
  });
});

describe('the sources a Codex catalog fetch walks', () => {
  test('a source whose reach fails is passed over for the next one that answers', async () => {
    const valid = encoded([aModel()]);
    const fetchLike = fetchServing([new Error('connection reset'), valid]);

    await expect(fetchCodexModelCatalog(fetchLike, ['first', 'second'])).resolves.toEqual(valid);
  });

  test('a source that answers an invalid catalog is passed over for the next one', async () => {
    const valid = encoded([aModel()]);
    const fetchLike = fetchServing([encoded([]), valid]);

    await expect(fetchCodexModelCatalog(fetchLike, ['first', 'second'])).resolves.toEqual(valid);
  });

  test('every source failing to reach leaves the fetch with nothing to serve', async () => {
    const fetchLike = fetchServing([new Error('offline'), new Error('offline')]);

    await expect(fetchCodexModelCatalog(fetchLike, ['first', 'second'])).rejects.toThrow(
      'no valid Codex model catalog source',
    );
  });
});

describe('the revisioned snapshot a load leaves behind', () => {
  let previous: Uint8Array | undefined;

  beforeEach(() => {
    previous = codexModelCatalogSnapshot().data;
  });

  afterEach(() => {
    if (previous !== undefined) loadCodexModelCatalog(previous);
  });

  test('loading the catalog already in force reports no change and holds the revision', () => {
    const inForce = codexModelCatalogSnapshot();

    expect(loadCodexModelCatalog(inForce.data)).toBe(false);
    expect(codexModelCatalogSnapshot().revision).toBe(inForce.revision);
  });

  test('loading a different catalog reports the change and moves the revision on', () => {
    const before = codexModelCatalogSnapshot();

    expect(loadCodexModelCatalog(encoded([aModel({ description: 'a newer wording' })]))).toBe(true);
    expect(codexModelCatalogSnapshot().revision).toBe(before.revision + 1);
  });

  test('a refresh that reaches a newer catalog adopts it', async () => {
    const fetchLike = fetchServing([encoded([aModel({ description: 'refreshed wording' })])]);

    await expect(refreshCodexModelCatalog(fetchLike, ['source'])).resolves.toBe(true);
    expect(new TextDecoder().decode(codexModelCatalogSnapshot().data)).toContain(
      'refreshed wording',
    );
  });

  test('a refresh where no source can be reached keeps the catalog in force', async () => {
    loadCodexModelCatalog(encoded([aModel({ description: 'the standing wording' })]));
    const before = codexModelCatalogSnapshot();

    await expect(refreshCodexModelCatalog(vi.fn<typeof fetch>(), ['source'])).resolves.toBe(false);
    expect(codexModelCatalogSnapshot()).toEqual(before);
  });
});
