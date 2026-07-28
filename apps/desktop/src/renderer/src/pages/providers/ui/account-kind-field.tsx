import type { IpcRequest } from '@recompose/contracts';

import { Field } from '@base-ui/react/field';
import { accountKindSchema } from '@recompose/contracts';

import { FieldRow } from '../../../shared/ui/field-row';

type AccountKind = IpcRequest<'accounts:connect'>['kind'];

type AccountKindFieldProps = {
  /** Controlled account kind. */
  value: AccountKind;
  /** Receives the kind the maintainer picked. */
  onChangeValue: (kind: AccountKind) => void;
};

/** Selector for the three account kinds an account can connect as. */
export function AccountKindField({ value, onChangeValue }: AccountKindFieldProps) {
  return (
    <FieldRow
      control={
        <Field.Control
          onChange={(event) => {
            onChangeValue(accountKindSchema.parse(event.currentTarget.value));
          }}
          render={
            <select className="h-[22px] rounded-control border border-line-strong bg-surface-card px-2 text-control text-ink">
              <option value="subscription">subscription</option>
              <option value="api-key">api-key</option>
              <option value="aggregator">aggregator</option>
            </select>
          }
          value={value}
        />
      }
      label="Kind"
    />
  );
}
