import { Field } from '@base-ui/react/field';

type TextFieldProps = {
  /** Visible label naming the value. */
  label: string;
  /** Controlled input value. */
  value: string;
  /** Switches masking for secret entry. */
  type?: 'password' | 'text';
  /** Receives the raw input value on every keystroke. */
  onChangeValue: (value: string) => void;
};

/**
 * Labeled single-line text entry that reports every keystroke.
 *
 * @summary Reach for it when a draft belongs to the form rather than to storage.
 */
export function TextField({ label, value, type = 'text', onChangeValue }: TextFieldProps) {
  return (
    <Field.Root className="flex flex-col gap-1">
      <Field.Label className="text-body text-ink">{label}</Field.Label>
      <Field.Control
        className="h-[22px] rounded-control border border-line-strong bg-surface-card px-2 text-control text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        onChange={(event) => {
          onChangeValue(event.currentTarget.value);
        }}
        type={type}
        value={value}
      />
    </Field.Root>
  );
}
