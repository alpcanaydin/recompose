type TextFieldProps = {
  label: string;
  value: string;
  type?: 'password' | 'text';
  onChangeValue: (value: string) => void;
};

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
