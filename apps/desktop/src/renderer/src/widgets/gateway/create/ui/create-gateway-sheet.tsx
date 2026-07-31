import type { GatewayConfig } from '@recompose/contracts';
import type { Ref, RefObject } from 'react';

import { Field } from '@base-ui/react/field';
import { GATEWAY_CONFIG_VERSION } from '@recompose/contracts';
import { useEffect, useRef, useState } from 'react';

import { IpcResultError, fetchOfferedPort, useSaveGateway } from '../../../../shared/api';
import { Sheet } from '../../../../shared/ui';
import { portRefusal, previewAddressFor, slugRefusal } from '../lib/gateway-draft';

type CreateGatewaySheetProps = {
  /** Whether the sheet stands on screen. */
  open: boolean;
  /** Receives the state the person asked for, including a dismissal and a finished save. */
  onOpenChange: (open: boolean) => void;
};

const SLUG_TAKEN_REFUSAL = 'Another gateway holds this slug.';

type FieldRefusals = {
  slug?: string | undefined;
  port?: string | undefined;
};

function refusalsBeforeSaving(slug: string, port: string): FieldRefusals {
  return { slug: slugRefusal(slug), port: portRefusal(port) };
}

function refusalFromMain(failure: unknown): FieldRefusals {
  if (!(failure instanceof IpcResultError)) {
    return {};
  }

  if (failure.code === 'slug-conflict') {
    return { slug: SLUG_TAKEN_REFUSAL };
  }

  return failure.code === 'port-conflict' ? { port: failure.message } : {};
}

function FieldMessage({ refusal }: { refusal: string | undefined }) {
  if (refusal === undefined) {
    return null;
  }

  return (
    <Field.Error className="w-full text-caption text-danger-ink" match role="alert">
      {refusal}
    </Field.Error>
  );
}

type DraftRowProps = {
  /** Name of the field, leading its row and carried as the control's accessible name. */
  label: string;
  /** Controlled value of the control. */
  value: string;
  /** Receives every keystroke, which also clears any refusal standing under the field. */
  onChangeValue: (value: string) => void;
  /** Sentence explaining why the last save refused this field. */
  refusal?: string | undefined;
  /** Width and family classes for the control, which the three fields do not share. */
  controlClasses: string;
  /** Reaches the input itself, so the sheet can land opening focus on this row. */
  ref?: Ref<HTMLInputElement> | undefined;
};

function DraftRow({ label, value, onChangeValue, refusal, controlClasses, ref }: DraftRowProps) {
  return (
    <Field.Root className="field-box-row">
      <Field.Label>{label}</Field.Label>
      <Field.Control
        className={`ms-auto sheet-field focus-ring ${controlClasses}`}
        onChange={(event) => {
          onChangeValue(event.currentTarget.value);
        }}
        ref={ref}
        value={value}
      />
      <FieldMessage refusal={refusal} />
    </Field.Root>
  );
}

function PreviewLine({ port }: { port: string }) {
  return (
    <p className="mt-2.5 flex items-center gap-1.75 px-0.5 font-mono text-quiet text-ink-secondary">
      <span aria-hidden className="size-1.75 shrink-0 rounded-pill bg-ink-tertiary" />
      <span>Serves at</span>
      <span className="font-medium text-ink">{previewAddressFor(port)}</span>
    </p>
  );
}

type SheetFooterProps = {
  /** Hands the screen back without storing anything. */
  onCancel: () => void;
  /** Tries the save, which either stores the gateway or explains why it did not. */
  onCreate: () => void;
};

function SheetFooter({ onCancel, onCreate }: SheetFooterProps) {
  return (
    <>
      <button className="push-button" onClick={onCancel} type="button">
        Cancel
      </button>
      <button className="push-button-primary" onClick={onCreate} type="button">
        Create Gateway
      </button>
    </>
  );
}

function useOfferedPort(): [string, (port: string) => void] {
  const [port, setPort] = useState('');

  useEffect(() => {
    let awaited = true;

    fetchOfferedPort()
      .then((offered) => {
        if (awaited) {
          setPort(String(offered));
        }
      })
      .catch(() => {
        if (awaited) {
          setPort('');
        }
      });

    return () => {
      awaited = false;
    };
  }, []);

  return [port, setPort];
}

function gatewayFrom(displayName: string, slug: string, port: string): GatewayConfig {
  return {
    schemaVersion: GATEWAY_CONFIG_VERSION,
    slug,
    displayName,
    port: Number(port),
    virtualModels: [],
    layout: { nodes: {} },
  };
}

function useGatewayDraft(onOpenChange: (open: boolean) => void) {
  const [displayName, setDisplayName] = useState('');
  const [slug, setSlug] = useState('');
  const [port, setPort] = useOfferedPort();
  const [refusals, setRefusals] = useState<FieldRefusals>({});
  const saveGateway = useSaveGateway();

  function save() {
    const refused = refusalsBeforeSaving(slug, port);

    if (refused.slug !== undefined || refused.port !== undefined) {
      setRefusals(refused);

      return;
    }

    saveGateway.mutate(gatewayFrom(displayName, slug, port), {
      onSuccess: () => {
        onOpenChange(false);
      },
      onError: (failure) => {
        setRefusals(refusalFromMain(failure));
      },
    });
  }

  return {
    displayName,
    setDisplayName,
    slug,
    port,
    refusals,
    save,
    changeSlug: (typed: string) => {
      setSlug(typed);
      setRefusals((held) => ({ ...held, slug: undefined }));
    },
    changePort: (typed: string) => {
      setPort(typed);
      setRefusals((held) => ({ ...held, port: undefined }));
    },
  };
}

type DraftFieldsProps = {
  /** Everything the three fields read and write. */
  draft: ReturnType<typeof useGatewayDraft>;
  /** Control the sheet lands opening focus on. */
  nameField: RefObject<HTMLInputElement | null>;
};

function DraftFields({ draft, nameField }: DraftFieldsProps) {
  return (
    <div className="field-box">
      <DraftRow
        controlClasses="w-sheet-field"
        label="Name"
        onChangeValue={(typed) => {
          draft.setDisplayName(typed);
        }}
        ref={nameField}
        value={draft.displayName}
      />
      <DraftRow
        controlClasses="w-sheet-field text-end font-mono"
        label="Slug"
        onChangeValue={(typed) => {
          draft.changeSlug(typed);
        }}
        refusal={draft.refusals.slug}
        value={draft.slug}
      />
      <DraftRow
        controlClasses="w-sheet-port text-end font-mono"
        label="Port"
        onChangeValue={(typed) => {
          draft.changePort(typed);
        }}
        refusal={draft.refusals.port}
        value={draft.port}
      />
    </div>
  );
}

type GatewayDraftProps = CreateGatewaySheetProps & {
  /** Control the sheet lands opening focus on. */
  nameField: RefObject<HTMLInputElement | null>;
};

function GatewayDraft({ open, onOpenChange, nameField }: GatewayDraftProps) {
  const draft = useGatewayDraft(onOpenChange);
  const footer = (
    <SheetFooter
      onCancel={() => {
        onOpenChange(false);
      }}
      onCreate={() => {
        draft.save();
      }}
    />
  );

  return (
    <Sheet
      description="Name it and pick the port it serves on."
      footer={footer}
      initialFocus={nameField}
      onOpenChange={onOpenChange}
      open={open}
      title="Create a gateway"
    >
      <DraftFields draft={draft} nameField={nameField} />
      <PreviewLine port={draft.port} />
    </Sheet>
  );
}

/**
 * The form that names a gateway, gives it a slug, and picks the port it will answer on.
 *
 * @summary Reach for it from anywhere a person can ask for a gateway. It arrives with a free
 * port already filled in, previews the address live, and stays open carrying the sentence that
 * explains any refusal rather than throwing the draft away.
 */
export function CreateGatewaySheet({ open, onOpenChange }: CreateGatewaySheetProps) {
  const nameField = useRef<HTMLInputElement>(null);

  return (
    <GatewayDraft
      key={String(open)}
      nameField={nameField}
      onOpenChange={onOpenChange}
      open={open}
    />
  );
}
