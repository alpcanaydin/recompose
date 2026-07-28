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
  /** Sentence naming the accepted range, read out with the field. */
  description: string;
};

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
    <>
      <Field.Control
        aria-describedby={descriptionId}
        aria-label={label}
        className="h-[22px] w-[76px] rounded-control border border-line-strong bg-surface-card px-2 text-right text-control text-ink tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
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
      <p className="text-caption text-ink" id={descriptionId}>
        {description}
      </p>
    </>
  );
}
