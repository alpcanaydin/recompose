import type { GatewayConfig } from '@recompose/contracts';

import { useForm, useSelector } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { SettledDefinition } from './model-draft';

import {
  providerModelsQueryOptions,
  refusalSentence,
  useDefineVirtualModel,
} from '../../../shared/api';
import {
  gatewayDefining,
  idFollowingName,
  idRefusal,
  modelListReading,
  nameRefusal,
  refusalFromMain,
} from './model-draft';

function useOfferedModels(accountId: string) {
  const look = useQuery({
    ...providerModelsQueryOptions(accountId),
    enabled: accountId !== '',
  });
  const reading = modelListReading(look.data);

  return {
    offered: reading.offered,
    refusal: look.error === null ? reading.refusal : refusalSentence(look.error),
    looking: look.isFetching,
  };
}

function useSubmittingForm(
  gateway: GatewayConfig,
  opening: SettledDefinition,
  onDefined: () => void,
  onRefused: (failure: unknown) => void,
) {
  const define = useDefineVirtualModel();
  const form = useForm({
    defaultValues: opening,
    onSubmit: ({ value }) => {
      define.mutate(gatewayDefining(gateway, value), { onSuccess: onDefined, onError: onRefused });
    },
  });

  return { form, saving: define.isPending };
}

type DraftForm = ReturnType<typeof useSubmittingForm>['form'];

function fieldSetters(form: DraftForm) {
  return {
    typeName: (typed: string) => {
      const nextId = idFollowingName(form.state.values.displayName, typed, form.state.values.id);

      form.setFieldValue('displayName', typed);
      form.setFieldValue('id', nextId);
    },
    typeId: (typed: string) => {
      form.setFieldValue('id', typed);
    },
    pickTarget: (picked: string) => {
      form.setFieldValue('accountId', picked);
      form.setFieldValue('providerModel', '');
    },
    pickModel: (picked: string) => {
      form.setFieldValue('providerModel', picked);
    },
  };
}

/**
 * Everything the flow's fields read and write, from the id a name derives to the save itself.
 *
 * @summary The id follows the name as a person types and then detaches the moment they edit it,
 * so what a client sends is theirs to keep, and the save stores it byte for byte rather than
 * deriving it again. The model list belongs to the picked target, so it is asked for the moment
 * one is picked and never before, and a look that answered nothing refuses where the models would
 * stand. A refused save keeps its sentence apart, so the flow says each thing in the place it belongs.
 */
export function useModelDraft(
  gateway: GatewayConfig,
  onDefined: () => void,
  opening: SettledDefinition,
) {
  const [refusal, setRefusal] = useState<string | undefined>(undefined);
  const [attempted, setAttempted] = useState(false);
  const { form, saving } = useSubmittingForm(gateway, opening, onDefined, (failure) => {
    setRefusal(refusalFromMain(failure));
  });

  const values = useSelector(form.store, (state) => state.values);
  const models = useOfferedModels(values.accountId);

  return {
    form,
    models,
    attempted,
    saving,
    refusal,
    displayName: values.displayName,
    picked: {
      id: values.id,
      target: values.accountId === '' ? undefined : values.accountId,
      providerModel: values.providerModel,
    },
    settled: values.accountId !== '' && values.providerModel !== '',
    ...fieldSetters(form),
    save: () => {
      setAttempted(true);

      const refused =
        nameRefusal(values.displayName) ?? idRefusal(values.id, gateway.virtualModels);

      if (refused !== undefined) {
        return;
      }

      void form.handleSubmit();
    },
    clearRefusal: () => {
      setRefusal(undefined);
    },
  };
}
