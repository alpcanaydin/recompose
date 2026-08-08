import { type WebSocket } from 'ws';

export async function xaiWebSocketReady(socket: WebSocket): Promise<void> {
  await new Promise<void>((resolve) => {
    socket.once('open', resolve);
    socket.once('error', resolve);
    socket.once('unexpected-response', resolve);
  });
}
