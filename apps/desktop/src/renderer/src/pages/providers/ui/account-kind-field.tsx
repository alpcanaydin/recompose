import type { IpcRequest } from '@recompose/contracts';

import { accountKindSchema } from '@recompose/contracts';

type AccountKind = IpcRequest<'accounts:connect'>['kind'];

type AccountKindFieldProps = {
  value: AccountKind;
  onChangeValue: (kind: AccountKind) => void;
};

/** Selector for the three account kinds an account can connect as. */
export function AccountKindField({ value, onChangeValue }: AccountKindFieldProps) {
  return (
    <label>
      Kind
      <select
        value={value}
        onChange={(event) => {
          onChangeValue(accountKindSchema.parse(event.target.value));
        }}
      >
        <option value="subscription">subscription</option>
        <option value="api-key">api-key</option>
        <option value="aggregator">aggregator</option>
      </select>
    </label>
  );
}
