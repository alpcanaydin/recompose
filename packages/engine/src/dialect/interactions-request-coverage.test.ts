import { describe, expect, it } from 'vitest';

import type { HubMessage, HubRequest } from './hub';
import type { InteractionsRequest, InteractionsTurn } from './interactions-wire';

import { decodeRequest } from './interactions-request';

const turnRoles: readonly { role: InteractionsTurn['role']; speaks: HubMessage['role'] }[] = [
  { role: 'user', speaks: 'user' },
  { role: 'model', speaks: 'assistant' },
  { role: 'assistant', speaks: 'assistant' },
];

function hubOf(request: InteractionsRequest): HubRequest {
  const decoded = decodeRequest(request);

  if ('refusal' in decoded) throw new Error('the Interactions request was refused');

  return decoded.value;
}

function messagesOf(request: InteractionsRequest): readonly HubMessage[] {
  return hubOf(request).messages;
}

describe('the steps an Interactions turn carries into the hub', () => {
  it('should keep tool arguments the caller already sent as an object', () => {
    const messages = messagesOf({
      input: [
        { type: 'function_call', call_id: 'call_1', name: 'lookup', arguments: { city: 'Berlin' } },
      ],
    });

    expect(messages[0]?.content[0]).toMatchObject({ type: 'tool_use', input: { city: 'Berlin' } });
  });

  it('should read the output field of a structured tool result as its text', () => {
    const messages = messagesOf({
      input: [{ type: 'function_result', call_id: 'call_1', result: { output: 'sunny' } }],
    });

    expect(messages[0]?.content[0]).toMatchObject({
      type: 'tool_result',
      content: [{ type: 'text', text: 'sunny' }],
    });
  });

  it('should carry the signature a thought step was signed with', () => {
    const messages = messagesOf({
      input: [{ type: 'thought', content: 'weighing options', signature: 'sig-thought' }],
    });

    expect(messages[0]?.content[0]).toMatchObject({ type: 'thinking', signature: 'sig-thought' });
  });

  it('should read a thought step that carries no content as an empty one', () => {
    const messages = messagesOf({ input: [{ type: 'thought', signature: 'sig-thought' }] });

    expect(messages[0]?.content[0]).toMatchObject({ type: 'thinking', text: '' });
  });

  it('should carry the signature a function call was signed with', () => {
    const messages = messagesOf({
      input: [
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'lookup',
          arguments: '{"city":"Berlin"}',
          signature: 'sig-call',
        },
      ],
    });

    expect(messages[0]?.content[0]).toMatchObject({ type: 'tool_use', signature: 'sig-call' });
  });

  it('should name the tool a result answers when the caller says so', () => {
    const messages = messagesOf({
      input: [{ type: 'function_result', call_id: 'call_1', name: 'lookup', result: 'sunny' }],
    });

    expect(messages[0]?.content[0]).toMatchObject({ type: 'tool_result', name: 'lookup' });
  });
});

describe('the roles an Interactions turn hands to the hub', () => {
  it('should leave the steps of a user turn speaking as the user', () => {
    const messages = messagesOf({
      input: { role: 'user', steps: [{ type: 'user_input', content: 'hello' }] },
    });

    expect(messages.map(({ role }) => role)).toEqual(['user']);
  });

  it('should make every step of an assistant turn speak as the assistant', () => {
    const messages = messagesOf({
      input: { role: 'model', steps: [{ type: 'user_input', content: 'restated' }] },
    });

    expect(messages.map(({ role }) => role)).toEqual(['assistant']);
  });

  it.each(turnRoles)('should read the parts of a $role turn that carries no steps', (turn) => {
    const messages = messagesOf({ input: { role: turn.role, parts: [{ text: 'hello' }] } });

    expect(messages).toEqual([{ role: turn.speaks, content: [{ type: 'text', text: 'hello' }] }]);
  });

  it('should read a turn that carries neither steps nor parts as an empty one', () => {
    expect(messagesOf({ input: { role: 'user' } })).toEqual([{ role: 'user', content: [] }]);
  });
});

describe('the tools and instructions an Interactions request declares', () => {
  it('should read a tool group that declares nothing as declaring nothing', () => {
    expect(hubOf({ input: 'hello', tools: [{}] }).tools).toEqual([]);
  });

  it('should read the system instruction out of its parts when it names no text', () => {
    const hub = hubOf({
      input: 'hello',
      system_instruction: { parts: [{ text: 'house style' }] },
    });

    expect(hub.system).toEqual([{ text: 'house style' }]);
  });

  it('should carry no system instruction when its parts spell out nothing', () => {
    expect(hubOf({ input: 'hello', system_instruction: { parts: [] } })).not.toHaveProperty(
      'system',
    );
  });
});
