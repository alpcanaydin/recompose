import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const IMAGE_TOOL = { type: 'image_generation', output_format: 'png' };

export function codexResponsesLite(body: JsonObject): boolean {
  const metadata = body['client_metadata'];

  if (!isJsonObject(metadata)) return false;

  const value = metadata['ws_request_header_x_openai_internal_codex_responses_lite'];

  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}

function imageFunction(value: JsonObject): boolean {
  if (value['type'] === 'function') return value['name'] === 'image_gen.imagegen';
  if (value['type'] !== 'namespace' || value['name'] !== 'image_gen') return false;

  const tools = value['tools'];

  return (
    Array.isArray(tools) &&
    tools.some(
      (tool) => isJsonObject(tool) && tool['type'] === 'function' && tool['name'] === 'imagegen',
    )
  );
}

function hasImageTool(tools: unknown[]): boolean {
  return tools.some(
    (tool) => isJsonObject(tool) && (tool['type'] === 'image_generation' || imageFunction(tool)),
  );
}

function sparkModel(body: JsonObject): boolean {
  return typeof body['model'] === 'string' && body['model'].endsWith('spark');
}

function freePlan(planType: string | undefined): boolean {
  return planType?.trim().toLowerCase() === 'free';
}

function excluded(
  body: JsonObject,
  planType: string | undefined,
  forcedResponsesLite: boolean,
): boolean {
  return forcedResponsesLite || codexResponsesLite(body) || sparkModel(body) || freePlan(planType);
}

export function injectCodexImageTool(
  body: JsonObject,
  planType: string | undefined,
  forcedResponsesLite = false,
): void {
  if (excluded(body, planType, forcedResponsesLite)) return;

  const tools = body['tools'];

  if (!Array.isArray(tools)) {
    body['tools'] = [IMAGE_TOOL];

    return;
  }

  const entries: unknown[] = tools;

  if (!hasImageTool(entries)) body['tools'] = [...entries, IMAGE_TOOL];
}
