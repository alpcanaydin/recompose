import type { ReactNode, RefObject } from 'react';

import { Field } from '@base-ui/react/field';
import { Link } from '@tanstack/react-router';

import type { OptionGroup } from '../option-list/option-list';

import { CopyButton } from '../../../../shared/ui';
import { discoveryHint } from '../../lib/model-draft';
import { OptionList } from '../option-list/option-list';

const MODEL_ID_HELP = 'Clients send this exact string as the model.';

export type ModelFieldsProps = {
  /** Control the flow lands opening focus on. */
  nameField: RefObject<HTMLInputElement | null>;
  /** The name as it stands in the draft. */
  name: string;
  /** Sentence standing under the name field, where one applies. */
  nameRefusal?: string | undefined;
  /** Receives every keystroke in the name field. */
  onNameChange: (typed: string) => void;
  /** The id a client sends, derived from the name until a person edits it here. */
  id: string;
  /** Sentence standing under the model id field, where one applies. */
  idRefusal?: string | undefined;
  /** Receives every keystroke in the model id field. */
  onIdChange: (typed: string) => void;
  /**
   * The accounts a target can name, gathered under the kinds they are held as, and nothing at all
   * while the registry has yet to answer. An empty list is a registry that answered with nobody who
   * can serve, which is a state a person has to be told about rather than shown as a blank.
   */
  targets: readonly OptionGroup[] | undefined;
  /** The account picked as the target, or nothing while none is. */
  target?: string | undefined;
  /** Receives the account the person picked. */
  onPickTarget: (accountId: string) => void;
  /** What the picked account reads as, which names whose list the models come from. */
  targetName?: string | undefined;
  /** The model ids the picked account serves as of this look. */
  models: readonly string[];
  /** The real model picked, which is empty while none is. */
  providerModel: string;
  /** Receives the model the person picked. */
  onPickModel: (providerModel: string) => void;
  /** Sentence standing where a look at the model list answered nothing. */
  modelRefusal?: string | undefined;
};

function nameField(props: ModelFieldsProps): ReactNode {
  return (
    <div className="px-3 py-2.5">
      <Field.Root>
        <Field.Label className="mb-1.5 block text-caption font-semibold text-ink-secondary">
          Name
        </Field.Label>
        <Field.Control
          className="field-control w-full focus-ring placeholder:text-ink-tertiary"
          onChange={(event) => {
            props.onNameChange(event.currentTarget.value);
          }}
          placeholder="Fast"
          ref={props.nameField}
          value={props.name}
        />
        {props.nameRefusal === undefined ? null : (
          <Field.Error className="mt-1.5 block text-caption text-danger-ink" match role="alert">
            {props.nameRefusal}
          </Field.Error>
        )}
      </Field.Root>
    </div>
  );
}

function modelIdBelow(id: string, refusal: string | undefined): ReactNode {
  if (refusal !== undefined) {
    return (
      <Field.Error className="mt-1.5 block text-caption text-danger-ink" match role="alert">
        {refusal}
      </Field.Error>
    );
  }

  const hint = id === '' ? undefined : discoveryHint(id);

  return (
    <Field.Description className="mt-1.5 block text-footnote text-ink-secondary">
      {MODEL_ID_HELP}
      {hint === undefined ? null : ` · ${hint}`}
    </Field.Description>
  );
}

function modelIdField(props: ModelFieldsProps): ReactNode {
  return (
    <div className="border-t border-line-faint px-3 py-2.5">
      <Field.Root>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <Field.Label className="text-caption font-semibold text-ink-secondary">
            Model id
          </Field.Label>
          <CopyButton announcement="Model id copied." label="Copy model id" value={props.id} />
        </div>
        <Field.Control
          className="field-control w-full font-mono focus-ring placeholder:text-ink-tertiary"
          onChange={(event) => {
            props.onIdChange(event.currentTarget.value);
          }}
          placeholder="fast"
          value={props.id}
        />
        {modelIdBelow(props.id, props.idRefusal)}
      </Field.Root>
    </div>
  );
}

function pickedFrom(label: ReactNode, control: ReactNode): ReactNode {
  return (
    <div className="border-t border-line-faint px-3 py-2.5">
      <p className="mb-1 text-caption font-semibold text-ink-secondary">{label}</p>
      {control}
    </div>
  );
}

function nothingCanServe(): ReactNode {
  return (
    <div className="flex flex-col items-start gap-1.5 rounded-control border border-line-faint bg-surface-inert p-2.5">
      <p className="text-control font-semibold text-ink">No account can serve yet</p>
      <p className="text-detail text-ink-secondary">Connect an account in Providers first.</p>
      <Link
        className="mt-1 push-button whitespace-nowrap"
        search={{ kind: 'api-key' }}
        to="/providers"
      >
        Open Providers
      </Link>
    </div>
  );
}

function targetControl(props: ModelFieldsProps): ReactNode {
  if (props.targets === undefined) {
    return null;
  }

  if (props.targets.length === 0) {
    return nothingCanServe();
  }

  return (
    <OptionList
      groups={props.targets}
      nothingMatched="No account matches that."
      onPick={props.onPickTarget}
      picked={props.target}
      searchLabel="Search accounts"
    />
  );
}

function modelLabel(targetName: string | undefined): ReactNode {
  return (
    <>
      <span>Model</span>
      {targetName === undefined ? null : (
        <span className="font-normal text-ink-secondary">
          {' '}
          · from {targetName}&apos;s live list
        </span>
      )}
    </>
  );
}

function modelControl(props: ModelFieldsProps): ReactNode {
  if (props.modelRefusal !== undefined) {
    return (
      <p
        className="rounded-control border border-danger/30 bg-danger/10 px-2.5 py-2 text-caption text-ink"
        role="alert"
      >
        {props.modelRefusal}
      </p>
    );
  }

  if (props.target === undefined) {
    return <p className="px-2 py-1.5 text-detail text-ink-secondary">Pick a target first.</p>;
  }

  return (
    <OptionList
      groups={[{ options: props.models.map((id) => ({ id, name: id })) }]}
      nothingMatched="No model matches that."
      onPick={props.onPickModel}
      picked={props.providerModel === '' ? undefined : props.providerModel}
      searchLabel="Search models"
    />
  );
}

/**
 * The fields a definition needs, in the order a person settles them.
 *
 * @summary The name and the id are typed and the target and the model are picked. The id a client
 * sends follows the name as it is derived and then a person may edit it, so it carries a copy and
 * the word that clients send it exactly. The model list belongs to the target, so it waits for one.
 * With nothing stored that can serve, the target says so and points at the screen that connects one,
 * because a picker left empty reads as a flow that failed rather than as a step not taken yet.
 */
export function ModelFields(props: ModelFieldsProps) {
  return (
    <div className="field-box">
      {nameField(props)}
      {modelIdField(props)}
      {pickedFrom('Target', targetControl(props))}
      {pickedFrom(modelLabel(props.targetName), modelControl(props))}
    </div>
  );
}
