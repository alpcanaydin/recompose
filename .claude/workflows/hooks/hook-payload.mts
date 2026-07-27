function readToolInput(payload: object): object {
  const toolInput = 'tool_input' in payload ? payload.tool_input : undefined;

  return typeof toolInput === 'object' && toolInput !== null ? toolInput : {};
}

export function readEditedPath(payload: object): string | undefined {
  const toolInput = readToolInput(payload);
  const editedPath = 'file_path' in toolInput ? toolInput.file_path : '';

  return typeof editedPath === 'string' && editedPath.length > 0 ? editedPath : undefined;
}
