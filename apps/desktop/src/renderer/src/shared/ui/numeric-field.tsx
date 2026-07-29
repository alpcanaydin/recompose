import { Field } from '@base-ui/react/field';
import { useId, useState } from 'react';

const wholeNumber = /^-?\d+$/;

function committableValue(draft: string, min: number, max: number): number | null {
  const candidate = draft.trim();

  if (!wholeNumber.test(candidate)) {
    return null;
  }

  const parsed = Number(candidate);

  return parsed >= min && parsed <= max ? parsed : null;
}

type NumericFieldProps = {
  /** Accessible name of the value being entered. */
  label: string;
  /** The stored value the draft falls back to. */
  value: number;
  /** Smallest value that may be committed. */
  min: number;
  /** Largest value that may be committed. */
  max: number;
  /** Receives a whole number inside the range, and nothing else. */
  onCommitValue: (value: number) => void;
  /** Sentence naming the accepted range, for a field standing on its own. Inside a row, the row states it. */
  description?: string;
};

function RangeNote({ id, note }: { id: string; note: string | undefined }) {
  if (note === undefined) {
    return null;
  }

  return (
    <p className="text-caption text-ink-secondary" id={id}>
      {note}
    </p>
  );
}

/**
 * Whole-number entry that holds a draft until the person means it.
 *
 * @summary Reach for it when a typed number should reach storage on blur or Enter, never per keystroke.
 */
export function NumericField({
  label,
  value,
  min,
  max,
  onCommitValue,
  description,
}: NumericFieldProps) {
  const descriptionId = useId();
  const [stored, setStored] = useState(value);
  const [draft, setDraft] = useState(String(value));

  if (stored !== value) {
    setStored(value);
    setDraft(String(value));
  }

  const commit = () => {
    const committable = committableValue(draft, min, max);

    setDraft(String(committable ?? value));

    if (committable !== null) {
      onCommitValue(committable);
    }
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Field.Control
        aria-describedby={description === undefined ? undefined : descriptionId}
        aria-label={label}
        className="field-control w-port text-end tabular-nums focus-ring"
        inputMode="numeric"
        onBlur={commit}
        onChange={(event) => {
          setDraft(event.currentTarget.value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commit();
          }

          if (event.key === 'Escape') {
            setDraft(String(value));
          }
        }}
        type="text"
        value={draft}
      />
      <RangeNote id={descriptionId} note={description} />
    </div>
  );
}
