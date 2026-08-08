import type { Fate } from './fates';
import type { HubMessage, HubTextBlock } from './hub';
import type { ResponsesInputItem, ResponsesReasoningItem } from './responses-wire';

import {
  compatibleGeminiCarrierSignature,
  decodeGeminiResponsesCarrier,
} from '../provider/gemini-responses-carrier';

type FoldedItems = { messages: HubMessage[]; fates: Fate[] };
type FoldItem = (item: ResponsesInputItem) => FoldedItems;

function validTextCarrier(
  item: ResponsesReasoningItem,
  direction: 'next' | 'previous',
): string | null {
  if (typeof item.encrypted_content !== 'string') return null;

  const decoded = decodeGeminiResponsesCarrier(item.encrypted_content);

  if (!isDirectionalTextCarrier(decoded, direction)) return null;

  return compatibleGeminiCarrierSignature(item.encrypted_content);
}

function isDirectionalTextCarrier(
  decoded: ReturnType<typeof decodeGeminiResponsesCarrier>,
  direction: 'next' | 'previous',
): boolean {
  if (!decoded.marked) return false;
  if (!decoded.valid) return false;

  return decoded.direction === direction && decoded.target === 'text';
}

function signMessageText(
  message: HubMessage,
  signature: string,
  direction: 'next' | 'previous',
): HubMessage | null {
  if (message.role !== 'assistant') return null;

  const content = [...message.content];
  const index = messageTextIndex(content, direction);

  if (index === undefined) return null;

  const block = textBlockAt(content, index);

  if (block === null || block.signature !== undefined) return null;

  content[index] = { ...block, signature };

  return { ...message, content };
}

function textBlockAt(content: HubMessage['content'], index: number): HubTextBlock | null {
  const block = content[index];

  return block?.type === 'text' ? block : null;
}

function messageTextIndex(
  content: HubMessage['content'],
  direction: 'next' | 'previous',
): number | undefined {
  const indexes = content.flatMap((block, index) => (block.type === 'text' ? [index] : []));

  return direction === 'next' ? indexes[0] : indexes.at(-1);
}

export function foldNextGeminiTextCarrier(
  item: ResponsesReasoningItem,
  next: ResponsesInputItem | undefined,
  foldItem: FoldItem,
): { outcome: FoldedItems; consumed: number } | null {
  const signature = validTextCarrier(item, 'next');

  if (signature === null) return null;
  if (next?.type !== 'message') return null;

  const outcome = foldItem(next);
  const signed = signedFirstMessage(outcome.messages, signature);

  if (signed === null) return null;

  return {
    outcome: {
      messages: [signed, ...outcome.messages.slice(1)],
      fates: [...outcome.fates, { field: 'encrypted_content', disposition: 'carried' }],
    },
    consumed: 2,
  };
}

function signedFirstMessage(messages: HubMessage[], signature: string): HubMessage | null {
  const message = messages[0];

  return message === undefined ? null : signMessageText(message, signature, 'next');
}

export function foldPreviousGeminiTextCarrier(
  item: ResponsesReasoningItem,
  messages: HubMessage[],
): Fate[] | null {
  const signature = validTextCarrier(item, 'previous');
  const previous = messages.at(-1);

  if (signature === null || previous === undefined) return null;

  const signed = signMessageText(previous, signature, 'previous');

  if (signed === null) return null;

  messages[messages.length - 1] = signed;

  return [{ field: 'encrypted_content', disposition: 'carried' }];
}
