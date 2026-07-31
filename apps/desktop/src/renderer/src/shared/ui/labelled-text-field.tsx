import type { Ref } from 'react';

import { Field } from '@base-ui/react/field';

type LabelledTextFieldProps = {
  /** Name of the field, shown beside it and carried as its accessible name. */
  label: string;
  /** Controlled input value. */
  value: string;
  /** Switches masking for secret entry. */
  type?: 'password' | 'text' | undefined;
  /** Receives the raw input value on every keystroke. */
  onChangeValue: (value: string) => void;
  /** Reaches the input itself, so a sheet can land opening focus on this field. */
  ref?: Ref<HTMLInputElement> | undefined;
};

/**
 * Text entry that carries its own visible label.
 *
 * @summary Reach for it in a form, where the field names itself. In a settings row the row owns
 * the label, so reach for `TextField` there instead.
 */
export function LabelledTextField({
  label,
  value,
  type = 'text',
  onChangeValue,
  ref,
}: LabelledTextFieldProps) {
  return (
    <Field.Root className="flex flex-col gap-1">
      <Field.Label className="text-body text-ink">{label}</Field.Label>
      <Field.Control
        className="field-control focus-ring"
        onChange={(event) => {
          onChangeValue(event.currentTarget.value);
        }}
        ref={ref}
        type={type}
        value={value}
      />
    </Field.Root>
  );
}
