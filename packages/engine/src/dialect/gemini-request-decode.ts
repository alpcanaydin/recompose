import type { TranslationRefusal } from '../refusals';
import type { Translated, TranslateResult } from './fates';
import type {
  GeminiContent,
  GeminiFunctionDeclaration,
  GeminiPart,
  GeminiRequest,
} from './gemini-wire';
import type { HubContentBlock, HubMessage, HubRequest, HubTool } from './hub';

import { emptyConversation } from '../refusals';
import { geminiRequestOptions } from './gemini-request-decode-options';
import { hubToolSchemaFrom } from './tool-schema';

type FunctionHistory = { nextId: number; standing: Map<string, string[]> };

function mediaBlock(part: GeminiPart): HubContentBlock | null {
  const inline = part.inlineData ?? snakeInlineData(part);

  if (inline !== undefined) return inlineBlock(inline.mimeType, inline.data);

  const file = part.fileData;

  return file === undefined ? null : fileBlock(file.mimeType, file.fileUri);
}

function snakeInlineData(part: GeminiPart): GeminiPart['inlineData'] {
  const inline = part.inline_data;

  return inline === undefined ? undefined : { mimeType: inline.mime_type, data: inline.data };
}

function inlineBlock(mimeType: string, data: string): HubContentBlock {
  if (mimeType.startsWith('image/')) {
    return { type: 'image', source: { type: 'base64', mediaType: mimeType, data } };
  }

  if (mimeType.startsWith('audio/')) {
    return { type: 'audio', source: { type: 'base64', mediaType: mimeType, data } };
  }

  if (mimeType.startsWith('video/')) {
    return { type: 'video', source: { type: 'base64', mediaType: mimeType, data } };
  }

  return {
    type: 'document',
    source: { type: 'base64', mediaType: mimeType, data },
    filename: 'document',
  };
}

function fileBlock(mimeType: string | undefined, uri: string): HubContentBlock {
  const type = mimeType ?? 'application/octet-stream';

  if (type.startsWith('image/')) return { type: 'image', source: { type: 'url', url: uri } };

  if (type.startsWith('audio/')) return { type: 'audio', source: { type: 'url', url: uri } };

  if (type.startsWith('video/')) return { type: 'video', source: { type: 'url', url: uri } };

  return { type: 'document', source: { type: 'url', url: uri }, filename: 'document' };
}

function fallbackCallId(history: FunctionHistory): string {
  const id = `call_${String(history.nextId)}`;

  history.nextId += 1;

  return id;
}

function explicitCallId(value: { id?: string; call_id?: string }): string | undefined {
  return value.id ?? value.call_id;
}

function rememberCall(history: FunctionHistory, name: string, id: string): void {
  const standing = history.standing.get(name) ?? [];

  standing.push(id);
  history.standing.set(name, standing);
}

function consumeCall(history: FunctionHistory, name: string, explicit: string | undefined): string {
  const standing = history.standing.get(name) ?? [];

  if (explicit !== undefined) {
    const matched = standing.indexOf(explicit);

    if (matched >= 0) standing.splice(matched, 1);

    return explicit;
  }

  return standing.shift() ?? fallbackCallId(history);
}

function callBlock(part: GeminiPart, history: FunctionHistory): HubContentBlock | null {
  const call = part.functionCall;

  if (call === undefined) return null;

  const id = explicitCallId(call) ?? fallbackCallId(history);

  rememberCall(history, call.name, id);

  return {
    type: 'tool_use',
    id,
    name: call.name,
    input: call.args ?? {},
    ...(part.thoughtSignature === undefined ? {} : { signature: part.thoughtSignature }),
  };
}

function resultBlock(part: GeminiPart, history: FunctionHistory): HubContentBlock | null {
  const result = part.functionResponse;

  if (result === undefined) return null;

  return {
    type: 'tool_result',
    toolUseId: consumeCall(history, result.name, explicitCallId(result)),
    name: result.name,
    content: [{ type: 'text', text: JSON.stringify(result.response) }],
    structuredResult: result.response,
  };
}

function textBlock(part: GeminiPart): HubContentBlock | null {
  if (part.text === undefined) return null;

  return part.thought === true
    ? {
        type: 'thinking',
        text: part.text,
        ...(part.thoughtSignature === undefined ? {} : { signature: part.thoughtSignature }),
      }
    : { type: 'text', text: part.text };
}

function partBlock(part: GeminiPart, history: FunctionHistory): HubContentBlock | null {
  return (
    callBlock(part, history) ?? resultBlock(part, history) ?? mediaBlock(part) ?? textBlock(part)
  );
}

function messageOf(content: GeminiContent, history: FunctionHistory): HubMessage {
  return {
    role: content.role === 'model' ? 'assistant' : 'user',
    content: content.parts.flatMap((part) => {
      const block = partBlock(part, history);

      return block === null ? [] : [block];
    }),
  };
}

function toolOf(tool: GeminiFunctionDeclaration): HubTool {
  return {
    name: tool.name,
    ...(tool.description === undefined ? {} : { description: tool.description }),
    inputSchema: hubToolSchemaFrom(tool.parameters),
  };
}

function toolsOf(request: GeminiRequest): readonly HubTool[] | undefined {
  const tools = request.tools?.flatMap((group) => group.functionDeclarations.map(toolOf));

  return tools === undefined || tools.length === 0 ? undefined : tools;
}

function translatedRequest(request: GeminiRequest, messages: HubMessage[]): Translated<HubRequest> {
  const tools = toolsOf(request);

  return {
    value: {
      messages,
      ...toolsField(tools),
      ...geminiRequestOptions(request),
    },
    fates: [],
  };
}

function toolsField(tools: HubRequest['tools']): Pick<HubRequest, 'tools'> | object {
  return tools === undefined ? {} : { tools };
}

function messagesOf(request: GeminiRequest): HubMessage[] {
  const messages: HubMessage[] = [];
  const history: FunctionHistory = { nextId: 0, standing: new Map() };

  for (const content of request.contents) {
    const message = messageOf(content, history);

    if (message.content.length > 0) messages.push(message);
  }

  return messages;
}

export function decodeRequest(
  request: GeminiRequest,
): TranslateResult<HubRequest, TranslationRefusal> {
  const messages = messagesOf(request);

  return messages.length === 0
    ? { refusal: emptyConversation() }
    : translatedRequest(request, messages);
}
