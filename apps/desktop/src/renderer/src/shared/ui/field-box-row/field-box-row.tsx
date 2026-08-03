import type { Ref } from 'react';

import { Field } from '@base-ui/react/field';

type FieldBoxRowProps = {
  /** Name of the field, leading its row and carried as the control's accessible name. */
  label: string;
  /** Controlled value of the control. */
  value: string;
  /** Standing hint inside an empty control, which never replaces the label. */
  placeholder?: string | undefined;
  /** Switches masking for secret entry. */
  type?: 'password' | 'text' | undefined;
  /** Receives every keystroke, which also clears any refusal standing under the field. */
  onChangeValue: (value: string) => void;
  /** Sentence explaining why the last save refused this field. */
  refusal?: string | undefined;
  /** Width and family classes for the control, which sibling fields do not share. */
  controlClasses: string;
  /** Reaches the input itself, so the sheet can land opening focus on this row. */
  ref?: Ref<HTMLInputElement> | undefined;
};

/** One labelled row of a field box, carrying its own refusal under the field it refuses. */
export function FieldBoxRow({
  label,
  value,
  placeholder,
  type = 'text',
  onChangeValue,
  refusal,
  controlClasses,
  ref,
}: FieldBoxRowProps) {
  return (
    <Field.Root className="field-box-row">
      <Field.Label>{label}</Field.Label>
      <Field.Control
        className={`ms-auto sheet-field focus-ring placeholder:text-ink-tertiary ${controlClasses}`}
        onChange={(event) => {
          onChangeValue(event.currentTarget.value);
        }}
        placeholder={placeholder}
        ref={ref}
        type={type}
        value={value}
      />
      {refusal === undefined ? null : (
        <Field.Error className="w-full text-caption text-danger-ink" match role="alert">
          {refusal}
        </Field.Error>
      )}
    </Field.Root>
  );
}
