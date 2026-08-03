import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION, slugFromName } from '@recompose/contracts';
import { useForm } from '@tanstack/react-form';
import { useEffect, useState } from 'react';

import type { DraftRefusals } from './gateway-draft';

import { fetchOfferedPort, refusalSentence, useSaveGateway } from '../../../../shared/api';
import { refusalFromMain } from './gateway-draft';

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

type PortReceiver = { setFieldValue: (field: 'port', offered: string) => void };

function useOfferedPort(form: PortReceiver) {
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  useEffect(() => {
    let awaited = true;

    fetchOfferedPort()
      .then((offered) => {
        if (awaited) {
          form.setFieldValue('port', String(offered));
        }
      })
      .catch((failure: unknown) => {
        if (awaited) {
          setRefusal(refusalSentence(failure));
        }
      });

    return () => {
      awaited = false;
    };
  }, [form]);

  return refusal;
}

/** Everything the sheet's fields read and write, from the offered port to the save itself. */
export function useGatewayDraft(
  onOpenChange: (open: boolean) => void,
  onCreated: (slug: string) => void,
) {
  const [mainRefusals, setMainRefusals] = useState<DraftRefusals>({});
  const saveGateway = useSaveGateway();

  const form = useForm({
    defaultValues: { displayName: '', port: '' },
    onSubmit: ({ value }) => {
      const slug = slugFromName(value.displayName);

      saveGateway.mutate(gatewayFrom(value.displayName, slug, value.port), {
        onSuccess: () => {
          onOpenChange(false);
          onCreated(slug);
        },
        onError: (failure) => {
          setMainRefusals(refusalFromMain(failure));
        },
      });
    },
  });

  const offerRefusal = useOfferedPort(form);

  return {
    form,
    refusals: { ...mainRefusals, sheet: mainRefusals.sheet ?? offerRefusal },
    save: () => {
      void form.handleSubmit();
    },
    saving: saveGateway.isPending,
    clearMainRefusal: (field: 'name' | 'port') => {
      setMainRefusals((held) => ({ ...held, [field]: undefined }));
    },
  };
}
