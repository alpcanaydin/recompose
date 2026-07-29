import { Field } from '@base-ui/react/field';

type TextFieldProps = {
  /** Accessible name of the field. Whatever shows it visibly must repeat this string. */
  label: string;
  /** Controlled input value. */
  value: string;
  /** Switches masking for secret entry. */
  type?: 'password' | 'text';
  /** Receives the raw input value on every keystroke. */
  onChangeValue: (value: string) => void;
  /** Marks a field whose machinery is missing, keeping it reachable but unmovable. */
  inert?: boolean;
};

/**
 * Labeled single-line text entry that reports every keystroke.
 *
 * @summary Reach for it when a draft belongs to the form rather than to storage.
 */
export function TextField({
  label,
  value,
  type = 'text',
  onChangeValue,
  inert = false,
}: TextFieldProps) {
  return (
    <Field.Root>
      <Field.Control
        aria-disabled={inert || undefined}
        aria-label={label}
        className="field-control focus-ring aria-disabled:cursor-not-allowed aria-disabled:bg-surface-inert"
        onChange={(event) => {
          onChangeValue(event.currentTarget.value);
        }}
        readOnly={inert}
        type={type}
        value={value}
      />
    </Field.Root>
  );
}
