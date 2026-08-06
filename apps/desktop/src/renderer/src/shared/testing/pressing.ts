type Canvas = {
  findByRole: (role: string, options: { name: string }) => Promise<HTMLElement>;
};

/**
 * Reaches a control the way a keyboard does and presses keys on it, answering the control.
 *
 * @summary A story asserting a keyboard behaviour has to put focus where a person's would be first,
 * so the sequence is one step rather than three that a story can get wrong in a different order than
 * its neighbour.
 */
export async function pressedByKeyboard(
  canvas: Canvas,
  found: { role: string; name: string },
  press: (keys: string) => Promise<void>,
  keys: string,
): Promise<HTMLElement> {
  const control = await canvas.findByRole(found.role, { name: found.name });

  control.focus();
  await press(keys);

  return control;
}
