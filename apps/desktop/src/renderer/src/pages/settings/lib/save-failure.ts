const notSaved = 'The change was not saved.';

export function saveStatusFor(field: string, unsavedFields: readonly string[]): string | undefined {
  return unsavedFields.includes(field) ? notSaved : undefined;
}
