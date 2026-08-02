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
  /** How the sentence reads: an alert that something failed, or a note that stands. */
  statusTone?: 'alert' | 'note';
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

function RowStatus({ sentence, tone }: { sentence: string; tone: 'alert' | 'note' }) {
  return <Field.Description {...statusStyles[tone]}>{sentence}</Field.Description>;
}

type RowTextProps = {
  label: string;
  notes: string[];
  status?: string | undefined;
  statusTone: 'alert' | 'note';
  inert: boolean;
};

function RowText({ label, notes, status, statusTone, inert }: RowTextProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <Field.Label className={labelClasses[inert ? 'inert' : 'live']}>{label}</Field.Label>
      {notes.map((note) => (
        <Field.Description className="text-caption text-ink-secondary" key={note}>
          {note}
        </Field.Description>
      ))}
      {status === undefined ? null : <RowStatus sentence={status} tone={statusTone} />}
    </div>
  );
}

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
      <RowText
        inert={inert}
        label={label}
        notes={notesFor(description, inert ? reason : undefined)}
        status={status}
        statusTone={statusTone}
      />
      <div className="shrink-0">{control}</div>
    </Field.Root>
  );
}
