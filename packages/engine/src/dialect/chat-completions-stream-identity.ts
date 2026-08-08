import type { ChatStreamFrame } from './chat-completions-wire';

export function chatIdentityFrame(
  frame: ChatStreamFrame,
  id: string | undefined,
  model: string | undefined,
): ChatStreamFrame {
  if (frame.type !== 'chunk') return frame;

  return {
    ...frame,
    chunk: {
      ...frame.chunk,
      ...(id === undefined ? {} : { id }),
      ...(model === undefined ? {} : { model }),
    },
  };
}
