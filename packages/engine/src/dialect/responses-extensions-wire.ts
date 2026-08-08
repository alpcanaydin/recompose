import type { ResponsesTool } from './responses-tools-wire';

export type ResponsesCustomToolCallItem = {
  type: 'custom_tool_call';
  call_id: string;
  name: string;
  input?: unknown;
};

export type ResponsesCustomToolCallOutputItem = {
  type: 'custom_tool_call_output';
  call_id: string;
  output?: unknown;
};

export type ResponsesCustomToolOutputItem = {
  type: 'custom_tool_call';
  id?: string;
  call_id: string;
  name: string;
  input: string;
};

export type ResponsesAdditionalToolsItem = {
  type: 'additional_tools';
  role?: string;
  tools: readonly ResponsesTool[];
};
