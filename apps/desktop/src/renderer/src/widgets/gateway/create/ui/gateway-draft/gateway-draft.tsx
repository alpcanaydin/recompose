import type { ReactNode, RefObject } from 'react';

import { useSelector } from '@tanstack/react-form';

import { FieldBoxRow, Sheet } from '../../../../../shared/ui';
import { nameRefusal, portRefusal, previewAddressFor } from '../../lib/gateway-draft';
import { useGatewayDraft } from '../../lib/use-gateway-draft';

export type GatewayDraftProps = {
  /** Whether the sheet stands on screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal and a finished save. */
  onOpenChange: (open: boolean) => void;
  /** Receives the slug a finished save stored, so the screen can follow the new gateway. */
  onCreated: (slug: string) => void;
  /** Control the sheet lands opening focus on. */
  nameField: RefObject<HTMLInputElement | null>;
};

type Draft = ReturnType<typeof useGatewayDraft>;

function draftFooter(draft: Draft, onOpenChange: (open: boolean) => void): ReactNode {
  return (
    <>
      <button
        className="push-button"
        onClick={() => {
          onOpenChange(false);
        }}
        type="button"
      >
        Cancel
      </button>
      <button
        className="push-button-primary"
        disabled={draft.saving}
        onClick={() => {
          draft.save();
        }}
        type="button"
      >
        Create Gateway
      </button>
    </>
  );
}

function spokenAfterAsking(attempted: boolean, spoken: string | undefined): string | undefined {
  return attempted ? spoken : undefined;
}

function draftFields(
  draft: Draft,
  attempted: boolean,
  nameField: RefObject<HTMLInputElement | null>,
): ReactNode {
  return (
    <div className="field-box">
      <draft.form.Field
        name="displayName"
        validators={{ onChange: ({ value }) => nameRefusal(value) }}
      >
        {(field) => (
          <FieldBoxRow
            controlClasses="w-sheet-field"
            label="Name"
            onChangeValue={(typed) => {
              field.handleChange(typed);
              draft.clearMainRefusal('name');
            }}
            ref={nameField}
            refusal={
              spokenAfterAsking(attempted, field.state.meta.errors[0]) ?? draft.refusals.name
            }
            value={field.state.value}
          />
        )}
      </draft.form.Field>
      <draft.form.Field name="port" validators={{ onChange: ({ value }) => portRefusal(value) }}>
        {(field) => (
          <FieldBoxRow
            controlClasses="w-sheet-port text-end font-mono"
            label="Port"
            onChangeValue={(typed) => {
              field.handleChange(typed);
              draft.clearMainRefusal('port');
            }}
            refusal={
              spokenAfterAsking(attempted, field.state.meta.errors[0]) ?? draft.refusals.port
            }
            value={field.state.value}
          />
        )}
      </draft.form.Field>
    </div>
  );
}

/** The standing draft of one gateway, from its fields to the save that stores it. */
export function GatewayDraft({ open, onOpenChange, onCreated, nameField }: GatewayDraftProps) {
  const draft = useGatewayDraft(onOpenChange, onCreated);
  const attempted = useSelector(draft.form.store, (state) => state.submissionAttempts > 0);
  const port = useSelector(draft.form.store, (state) => state.values.port);

  return (
    <Sheet
      description="Name it and pick the port it serves on."
      footer={draftFooter(draft, onOpenChange)}
      initialFocus={nameField}
      onOpenChange={onOpenChange}
      open={open}
      title="Create a gateway"
    >
      {draftFields(draft, attempted, nameField)}
      <p className="mt-2.5 flex items-center gap-1.75 px-0.5 font-mono text-mono-value text-ink-secondary">
        <span aria-hidden className="size-1.75 shrink-0 rounded-pill bg-ink-tertiary" />
        <span>Serves at</span>
        <span className="font-medium text-ink">{previewAddressFor(port)}</span>
      </p>
      {draft.refusals.sheet === undefined ? null : (
        <p className="mt-2.5 px-0.5 text-caption text-danger-ink" role="alert">
          {draft.refusals.sheet}
        </p>
      )}
    </Sheet>
  );
}
