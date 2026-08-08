import type { HubStreamEvent } from './hub';
import type { ResponsesBlockState } from './responses-stream-state';
import type { ResponsesKnownStreamEvent, ResponsesStreamItem } from './responses-wire';

type ImageStreamEvent =
  | Extract<ResponsesKnownStreamEvent, { type: 'response.image_generation_call.partial_image' }>
  | (Extract<ResponsesKnownStreamEvent, { type: 'response.output_item.done' }> & {
      item: ResponsesStreamItem & { type: 'image_generation_call' };
    });

function isImageEvent(event: ResponsesKnownStreamEvent): event is ImageStreamEvent {
  if (event.type === 'response.image_generation_call.partial_image') return true;

  return event.type === 'response.output_item.done' && event.item?.type === 'image_generation_call';
}

export function responsesImageEvents(
  event: ResponsesKnownStreamEvent,
  state: ResponsesBlockState,
): HubStreamEvent[] | null {
  if (!isImageEvent(event)) return null;

  if (event.type === 'response.image_generation_call.partial_image') {
    return carriedImage(state, event.item_id, event.partial_image_b64, event.output_format);
  }

  const result = event.item.result;

  return result === undefined
    ? []
    : carriedImage(
        state,
        event.item.id ?? `image_${String(event.output_index)}`,
        result,
        event.item.output_format,
      );
}

function carriedImage(
  state: ResponsesBlockState,
  id: string,
  data: string,
  format: string | undefined,
): HubStreamEvent[] {
  if (state.images.get(id) === data) return [];

  state.images.set(id, data);

  return [
    {
      type: 'media',
      block: {
        type: 'image',
        source: { type: 'base64', mediaType: `image/${format ?? 'png'}`, data },
      },
    },
  ];
}
