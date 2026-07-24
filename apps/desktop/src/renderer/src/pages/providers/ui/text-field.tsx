type TextFieldProps = {
  /** Visible label wrapping the input. */
  label: string;
  /** Controlled input value. */
  value: string;
  /** Switches masking for secret entry. */
  type?: 'password' | 'text';
  /** Receives the raw input value on every keystroke. */
  onChangeValue: (value: string) => void;
};

/** Labeled single-line text input used across provider forms. */
export function TextField({ label, value, type = 'text', onChangeValue }: TextFieldProps) {
  return (
    <label>
      {label}
      <input
        type={type}
        value={value}
        onInput={(event) => {
          onChangeValue(event.currentTarget.value);
        }}
      />
    </label>
  );
}
