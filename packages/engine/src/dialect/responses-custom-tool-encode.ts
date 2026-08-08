import type { HubTool, HubToolChoice, HubToolResultBlock, HubToolUseBlock } from './hub';
import type { ResponsesInputItem, ResponsesTool, ResponsesToolChoice } from './responses-wire';

import { responsesIdentifier } from './tool-id';

export function customResponsesTool(tool: HubTool): ResponsesTool {
  return {
    type: 'custom',
    name: responsesIdentifier(tool.name),
    ...(tool.description === undefined ? {} : { description: tool.description }),
  };
}

export function customResponsesChoice(
  choice: Extract<HubToolChoice, { type: 'tool' }>,
): ResponsesToolChoice {
  return { type: 'custom', name: responsesIdentifier(choice.name) };
}

export function customResponsesCall(block: HubToolUseBlock): ResponsesInputItem {
  const input = typeof block.input === 'string' ? block.input : JSON.stringify(block.input ?? {});

  return {
    type: 'custom_tool_call',
    call_id: responsesIdentifier(block.id),
    name: responsesIdentifier(block.name),
    input,
  };
}

export function customResponsesOutput(
  block: HubToolResultBlock,
  output: unknown,
): ResponsesInputItem {
  return { type: 'custom_tool_call_output', call_id: responsesIdentifier(block.toolUseId), output };
}
