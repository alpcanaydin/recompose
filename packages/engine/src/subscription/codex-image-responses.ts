import type { JsonObject } from '../gateway-wire';

import { isJsonObject } from '../gateway-wire';

const STRING_TOOL_FIELDS = [
  'size',
  'quality',
  'background',
  'output_format',
  'input_fidelity',
  'moderation',
] as const;
const NUMBER_TOOL_FIELDS = ['output_compression', 'partial_images'] as const;

function copiedFields(body: JsonObject, fields: readonly string[]): JsonObject {
  return Object.fromEntries(
    fields.flatMap((field) => (body[field] === undefined ? [] : [[field, body[field]]])),
  );
}

function imageUrls(body: JsonObject): string[] {
  const images = body['images'];

  return Array.isArray(images)
    ? images.flatMap((image) => {
        const url = isJsonObject(image) ? image['image_url'] : undefined;

        return typeof url === 'string' && url.trim() !== '' ? [url] : [];
      })
    : [];
}

function inputContent(body: JsonObject): JsonObject[] {
  const prompt = typeof body['prompt'] === 'string' ? body['prompt'].trim() : '';
  const images = imageUrls(body).map((imageUrl) => ({ type: 'input_image', image_url: imageUrl }));

  return [{ type: 'input_text', text: prompt }, ...images];
}

function imageTool(body: JsonObject, action: 'generate' | 'edit'): JsonObject {
  const mask = isJsonObject(body['mask']) ? body['mask']['image_url'] : undefined;

  return {
    type: 'image_generation',
    action,
    model: 'gpt-image-2',
    ...copiedFields(body, STRING_TOOL_FIELDS),
    ...copiedFields(body, NUMBER_TOOL_FIELDS),
    ...(typeof mask === 'string' && mask.trim() !== ''
      ? { input_image_mask: { image_url: mask } }
      : {}),
  };
}

export function codexImageResponsesBody(
  body: JsonObject,
  providerModel: string,
  action: 'generate' | 'edit',
): JsonObject {
  return {
    model: providerModel,
    instructions: '',
    stream: true,
    store: false,
    reasoning: { effort: 'medium', summary: 'auto' },
    parallel_tool_calls: true,
    include: ['reasoning.encrypted_content'],
    tool_choice: { type: 'image_generation' },
    tools: [imageTool(body, action)],
    input: [{ type: 'message', role: 'user', content: inputContent(body) }],
  };
}
