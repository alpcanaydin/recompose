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
  status?: string | undefined;
  /** How the sentence reads: an alert that something failed, or a note that stands. */
  statusTone?: 'alert' | 'note';
  /** Marks a setting whose machinery is missing, keeping the row reachable but unmovable. */
  inert?: boolean;
  /** Sentence naming what an inert setting waits for. */
  reason?: string | undefined;
};

const labelClasses = {
  live: 'text-body text-ink',
  inert: 'text-body text-ink-secondary',
};

const statusStyles = {
  alert: { className: 'border-s-2 border-danger ps-2 text-detail text-ink', role: 'alert' },
  note: {
    className: 'border-s-2 border-line-strong ps-2 text-detail text-ink-secondary',
    role: 'note',
  },
};

function notesFor(description?: string, reason?: string): string[] {
  return [description, reason].filter((note) => note !== undefined);
}

function statusLine(status: string | undefined, tone: 'alert' | 'note'): ReactNode {
  if (status === undefined) {
    return null;
  }

  return (
    <Field.Description className={statusStyles[tone].className} role={statusStyles[tone].role}>
      {status}
    </Field.Description>
  );
}

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
  statusTone = 'alert',
  inert = false,
  reason,
}: FieldRowProps) {
  return (
    <Field.Root className="flex min-h-row items-center justify-between gap-5 py-2.5">
      <div className="flex flex-col gap-0.5">
        <Field.Label className={labelClasses[inert ? 'inert' : 'live']}>{label}</Field.Label>
        {notesFor(description, inert ? reason : undefined).map((note) => (
          <Field.Description className="text-detail text-ink-secondary" key={note}>
            {note}
          </Field.Description>
        ))}
        {statusLine(status, statusTone)}
      </div>
      <div className="shrink-0">{control}</div>
    </Field.Root>
  );
}
