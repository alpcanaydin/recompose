import type { IpcRequest } from '@recompose/contracts';

import { Field } from '@base-ui/react/field';
import { credentialedAccountKindSchema } from '@recompose/contracts';

type AccountKind = IpcRequest<'accounts:connect'>['kind'];

type AccountKindFieldProps = {
  /** Controlled account kind. */
  value: AccountKind;
  /** Receives the kind the maintainer picked. */
  onChangeValue: (kind: AccountKind) => void;
};

/** Selector for the account kinds a pasted secret can connect as. */
export function AccountKindField({ value, onChangeValue }: AccountKindFieldProps) {
  return (
    <Field.Root className="flex flex-col gap-1">
      <Field.Label className="text-body text-ink">Kind</Field.Label>
      <Field.Control
        onValueChange={(picked) => {
          onChangeValue(credentialedAccountKindSchema.parse(picked));
        }}
        render={
          <select className="h-control w-fit rounded-control border border-line-strong bg-surface-card px-2 text-control text-ink">
            <option value="api-key">api-key</option>
            <option value="aggregator">aggregator</option>
          </select>
        }
        value={value}
      />
    </Field.Root>
  );
}
