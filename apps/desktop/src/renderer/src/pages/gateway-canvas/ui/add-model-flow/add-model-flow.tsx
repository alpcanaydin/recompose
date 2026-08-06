import type { GatewayConfig, VirtualModel } from '@recompose/contracts';
import type { ReactNode, RefObject } from 'react';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import type { OptionGroup } from '../option-list/option-list';

import { accountsQueryOptions } from '../../../../shared/api';
import { Icon, placeFocus } from '../../../../shared/ui';
import { nameRefusal, servesPreview } from '../../lib/model-draft';
import { targetGroups } from '../../lib/target-groups';
import { useModelDraft } from '../../lib/use-model-draft';
import { ModelFields } from '../model-fields/model-fields';

export type AddModelFlowProps = {
  /** The gateway the definition joins, whose stored shape the save carries whole. */
  gateway: GatewayConfig;
  /** Steps back to what the gateway serves, which a finished save also does. */
  onBack: () => void;
};

type Draft = ReturnType<typeof useModelDraft>;

function spokenAfterAsking(attempted: boolean, spoken: string | undefined): string | undefined {
  return attempted ? spoken : undefined;
}

function flowHead(slug: string, onBack: () => void): ReactNode {
  return (
    <header className="flex items-center gap-2.5 px-4 pt-4 pb-1">
      <button
        aria-label="Back"
        className="flex size-6.5 shrink-0 items-center justify-center rounded-control border border-line-subtle bg-surface-hover text-ink-secondary focus-ring row-hover"
        onClick={onBack}
        type="button"
      >
        <Icon className="size-4 rotate-90" name="chevron" />
      </button>
      <div className="min-w-0">
        <h2 className="text-heading text-ink">Add virtual model</h2>
        <p className="truncate font-mono text-mono-value text-accent-ink">{slug}</p>
      </div>
    </header>
  );
}

function flowFoot(draft: Draft, settled: boolean, onBack: () => void): ReactNode {
  return (
    <footer className="mt-auto flex gap-2 border-t border-line-faint px-3.5 py-3">
      <button className="push-button flex-1" onClick={onBack} type="button">
        Cancel
      </button>
      <button
        className="push-button-primary flex-1"
        disabled={!settled || draft.saving}
        onClick={() => {
          draft.save();
        }}
        type="button"
      >
        Add virtual model
      </button>
    </footer>
  );
}

type FlowView = {
  draft: Draft;
  /** The definitions this gateway already serves, which a new name may not collide with. */
  held: readonly VirtualModel[];
  nameField: RefObject<HTMLInputElement | null>;
  targets: readonly OptionGroup[];
  target: string | undefined;
  targetName: string | undefined;
  providerModel: string;
  attempted: boolean;
};

function draftFields(view: FlowView): ReactNode {
  const { draft } = view;
  const { pickTarget: onPickTarget, pickModel: onPickModel } = draft;

  return (
    <draft.form.Field
      name="displayName"
      validators={{ onChange: ({ value }) => nameRefusal(value, view.held) }}
    >
      {(field) => (
        <ModelFields
          models={draft.models.offered}
          modelRefusal={draft.models.refusal}
          name={field.state.value}
          nameField={view.nameField}
          nameRefusal={spokenAfterAsking(view.attempted, field.state.meta.errors[0])}
          onNameChange={(typed) => {
            field.handleChange(typed);
            draft.clearRefusal();
          }}
          onPickModel={onPickModel}
          onPickTarget={onPickTarget}
          providerModel={view.providerModel}
          target={view.target}
          targetName={view.targetName}
          targets={view.targets}
        />
      )}
    </draft.form.Field>
  );
}

function nameOfPicked(
  targets: readonly OptionGroup[],
  accountId: string | undefined,
): string | undefined {
  return targets.flatMap((group) => group.options).find((option) => option.id === accountId)?.name;
}

function servesLine(preview: string | undefined): ReactNode {
  return preview === undefined ? null : (
    <p className="border-t border-line-faint bg-surface-inert px-3.5 py-2 font-mono text-mono-value text-ink-secondary">
      {preview}
    </p>
  );
}

function refusedSave(refusal: string | undefined): ReactNode {
  return refusal === undefined ? null : (
    <p className="border-t border-line-faint px-3.5 py-2 text-caption text-danger-ink" role="alert">
      {refusal}
    </p>
  );
}

/**
 * The drawer state that defines one virtual model, from its three fields to the save.
 *
 * @summary It takes the drawer over rather than opening a sheet, because the definition belongs to
 * the gateway the drawer already stands for, and a person keeps their place. The act that stores
 * waits until the binding is whole, since neither pick can be typed wrong, only left unsaid.
 */
export function AddModelFlow({ gateway, onBack }: AddModelFlowProps) {
  const registry = useQuery(accountsQueryOptions);
  const draft = useModelDraft(gateway, onBack);
  const nameField = useRef<HTMLInputElement>(null);

  useEffect(() => {
    placeFocus(nameField.current);
  }, []);

  const targets = targetGroups(registry.data?.accounts ?? []);
  const targetName = nameOfPicked(targets, draft.picked.target);

  return (
    <>
      {flowHead(gateway.slug, onBack)}
      <div className="flex-1 overflow-y-auto px-3.5 pt-2 pb-4">
        {draftFields({
          draft,
          held: gateway.virtualModels,
          nameField,
          targets,
          targetName,
          attempted: draft.attempted,
          target: draft.picked.target,
          providerModel: draft.picked.providerModel,
        })}
      </div>
      {servesLine(servesPreview({ ...draft.picked, target: targetName }))}
      {refusedSave(draft.refusal)}
      {flowFoot(draft, draft.settled, onBack)}
    </>
  );
}
