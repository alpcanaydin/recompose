import type { ReactNode } from 'react';

import { Field } from '@base-ui/react/field';

type FieldRowProps = {
  /** Name of the setting, and the accessible name of the control beside it. */
  label: string;
  /** Sentence explaining what the setting does. */
  description?: string;
  /** The control that applies the setting. */
  control: ReactNode;
  /** Sentence announcing the outcome of the last attempt. */
  status?: string;
  /** Marks a setting whose machinery is missing, keeping the row reachable but unmovable. */
  inert?: boolean;
  /** Sentence naming what an inert setting waits for. */
  reason?: string;
};

/**
 * One setting: its name, its explanation, and the control that applies it.
 *
 * @summary The row an inert setting keeps, so a keyboard reader still reaches it and hears why.
 */
export function FieldRow({
  label,
  description,
  control,
  status,
  inert = false,
  reason,
}: FieldRowProps) {
  const notes = [description, inert ? reason : undefined].filter((note) => note !== undefined);

  return (
    <Field.Root className="flex min-h-row items-center justify-between gap-5 py-2.5">
      <div className="flex flex-col gap-0.5">
        <Field.Label className={inert ? 'text-body text-ink-secondary' : 'text-body text-ink'}>
          {label}
        </Field.Label>
        {notes.map((note) => (
          <Field.Description className="text-caption text-ink-secondary" key={note}>
            {note}
          </Field.Description>
        ))}
        {status === undefined ? null : (
          <Field.Description
            className="border-s-2 border-danger ps-2 text-caption text-ink"
            role="alert"
          >
            {status}
          </Field.Description>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </Field.Root>
  );
}
