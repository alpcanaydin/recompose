import { isJsonObject, parsedJson } from '../gateway-wire';

type CodexCatalogModel = {
  slug: string;
  display_name: string;
  description: string;
  context_window: number;
  max_output_tokens: number;
  default_reasoning_level: string;
  supported_reasoning_levels: readonly { effort: string }[];
  base_instructions: string;
  priority: number;
};

type CodexCatalog = { models: CodexCatalogModel[] };

const embeddedCatalog: CodexCatalog = {
  models: [
    {
      slug: 'gpt-5.5',
      display_name: 'GPT-5.5',
      description: 'Default Codex model.',
      context_window: 400_000,
      max_output_tokens: 128_000,
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'high' }],
      base_instructions: 'You are Codex.',
      priority: 1,
    },
    {
      slug: 'gpt-5.6-luna',
      display_name: 'GPT-5.6 Luna',
      description: 'Codex Luna model.',
      context_window: 400_000,
      max_output_tokens: 128_000,
      default_reasoning_level: 'medium',
      supported_reasoning_levels: [{ effort: 'low' }, { effort: 'medium' }, { effort: 'high' }],
      base_instructions: 'You are Codex.',
      priority: 2,
    },
  ],
};

let catalogBytes: Uint8Array = new TextEncoder().encode(JSON.stringify(embeddedCatalog));
let catalogRevision = 1;

function stringField(value: Record<string, unknown>, key: string): string | undefined {
  const field = value[key];

  return typeof field === 'string' && field !== '' ? field : undefined;
}

function numberField(value: Record<string, unknown>, key: string): number | undefined {
  const field = value[key];

  return typeof field === 'number' && Number.isFinite(field) ? field : undefined;
}

function validReasoning(value: Record<string, unknown>): boolean {
  const supported = value['supported_reasoning_levels'];
  const defaultLevel = stringField(value, 'default_reasoning_level');

  return (
    Array.isArray(supported) &&
    defaultLevel !== undefined &&
    supported.some((entry) => isJsonObject(entry) && entry['effort'] === defaultLevel)
  );
}

function validModel(value: unknown): value is CodexCatalogModel {
  if (!isJsonObject(value)) return false;

  return (
    ['slug', 'display_name', 'description', 'base_instructions'].every(
      (key) => stringField(value, key) !== undefined,
    ) &&
    ['context_window', 'max_output_tokens', 'priority'].every(
      (key) => numberField(value, key) !== undefined,
    ) &&
    validReasoning(value)
  );
}

function decodedModels(raw: Uint8Array): unknown[] {
  const value = parsedJson(new TextDecoder().decode(raw));
  const models = isJsonObject(value) ? value['models'] : undefined;

  if (!Array.isArray(models) || models.length === 0) throw new Error('invalid Codex model catalog');

  return models;
}

function catalogIdentityValid(models: readonly CodexCatalogModel[]): boolean {
  const slugs = models.map(({ slug }) => slug);

  return new Set(slugs).size === slugs.length && slugs.includes('gpt-5.5');
}

export function validateCodexModelCatalog(raw: Uint8Array): CodexCatalog {
  const models = decodedModels(raw);

  if (!models.every(validModel)) throw new Error('invalid Codex model catalog fields');

  if (!catalogIdentityValid(models)) {
    throw new Error('invalid Codex model catalog identity');
  }

  return { models };
}

export function codexModelCatalogSnapshot(): { data: Uint8Array; revision: number } {
  return { data: catalogBytes.slice(), revision: catalogRevision };
}

export function loadCodexModelCatalog(raw: Uint8Array): boolean {
  validateCodexModelCatalog(raw);
  const changed = new TextDecoder().decode(raw) !== new TextDecoder().decode(catalogBytes);

  if (changed) {
    catalogBytes = raw.slice();
    catalogRevision += 1;
  }

  return changed;
}

export async function fetchCodexModelCatalog(
  fetchLike: typeof fetch,
  urls: readonly string[],
): Promise<Uint8Array> {
  for (const url of urls) {
    const raw = await responseBytes(fetchLike, url);

    if (raw === undefined) continue;

    try {
      validateCodexModelCatalog(raw);

      return raw;
    } catch {
      continue;
    }
  }

  throw new Error('no valid Codex model catalog source');
}

async function responseBytes(
  fetchLike: typeof fetch,
  url: string,
): Promise<Uint8Array | undefined> {
  try {
    return await (await fetchLike(url)).bytes();
  } catch {
    return undefined;
  }
}

export async function refreshCodexModelCatalog(
  fetchLike: typeof fetch,
  urls: readonly string[],
): Promise<boolean> {
  const before = codexModelCatalogSnapshot();

  try {
    return loadCodexModelCatalog(await fetchCodexModelCatalog(fetchLike, urls));
  } catch {
    catalogBytes = before.data;
    catalogRevision = before.revision;

    return false;
  }
}
