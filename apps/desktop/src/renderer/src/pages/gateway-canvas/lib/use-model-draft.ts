import type { GatewayConfig } from '@recompose/contracts';

import { useForm, useSelector } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import type { ModelDraftRefusals } from './model-draft';

import {
  providerModelsQueryOptions,
  refusalSentence,
  useDefineVirtualModel,
} from '../../../shared/api';
import { gatewayDefining, modelListReading, refusalFromMain } from './model-draft';

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

/**
 * Everything the flow's fields read and write, from the target's model list to the save itself.
 *
 * @summary The model list belongs to the picked target, so it is asked for the moment one is
 * picked and never before, and a look that answered nothing refuses where the models would stand
 * rather than leaving the field looking empty for no stated reason.
 */
export function useModelDraft(gateway: GatewayConfig, onDefined: () => void) {
  const [mainRefusals, setMainRefusals] = useState<ModelDraftRefusals>({});
  const define = useDefineVirtualModel();

  const form = useForm({
    defaultValues: { displayName: '', accountId: '', providerModel: '' },
    onSubmit: ({ value }) => {
      define.mutate(gatewayDefining(gateway, value), {
        onSuccess: () => {
          onDefined();
        },
        onError: (failure) => {
          setMainRefusals(refusalFromMain(failure));
        },
      });
    },
  });

  const values = useSelector(form.store, (state) => state.values);
  const attempted = useSelector(form.store, (state) => state.submissionAttempts > 0);
  const models = useOfferedModels(values.accountId);

  return {
    form,
    models,
    attempted,
    picked: {
      displayName: values.displayName,
      target: values.accountId === '' ? undefined : values.accountId,
      providerModel: values.providerModel,
    },
    settled: values.accountId !== '' && values.providerModel !== '',
    refusals: { ...mainRefusals, sheet: mainRefusals.sheet ?? models.refusal },
    pickTarget: (picked: string) => {
      form.setFieldValue('accountId', picked);
      form.setFieldValue('providerModel', '');
    },
    pickModel: (picked: string) => {
      form.setFieldValue('providerModel', picked);
    },
    save: () => {
      void form.handleSubmit();
    },
    saving: define.isPending,
    clearNameRefusal: () => {
      setMainRefusals((held) => ({ ...held, name: undefined }));
    },
  };
}
