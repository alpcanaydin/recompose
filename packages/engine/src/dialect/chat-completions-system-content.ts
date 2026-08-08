import type { ChatContentPart } from './chat-completions-wire';

export function chatSystemTexts(content: string | readonly ChatContentPart[]): string[] {
  return typeof content === 'string'
    ? [content]
    : content.flatMap((part) => (part.type === 'text' ? [part.text] : []));
}
