const notSaved = 'The change was not saved.';

export function saveStatusFor(
  field: string,
  unsavedFields: readonly string[],
): { status?: string } {
  return unsavedFields.includes(field) ? { status: notSaved } : {};
}
