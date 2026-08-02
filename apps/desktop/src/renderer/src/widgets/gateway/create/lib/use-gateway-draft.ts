import type { GatewayConfig } from '@recompose/contracts';

import { GATEWAY_CONFIG_VERSION, slugFromName } from '@recompose/contracts';
import { useEffect, useState } from 'react';

import type { DraftRefusals } from './gateway-draft';

import { fetchOfferedPort, refusalSentence, useSaveGateway } from '../../../../shared/api';
import { refusalFromMain, refusalsBeforeSaving } from './gateway-draft';

function useOfferedPort() {
  const [port, setPort] = useState('');
  const [refusal, setRefusal] = useState<string | undefined>(undefined);

  useEffect(() => {
    let awaited = true;

    fetchOfferedPort()
      .then((offered) => {
        if (awaited) {
          setPort(String(offered));
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
  }, []);

  return { port, setPort, refusal };
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

/** Everything the sheet's fields read and write, from the offered port to the save itself. */
export function useGatewayDraft(
  onOpenChange: (open: boolean) => void,
  onCreated: (slug: string) => void,
) {
  const [displayName, setDisplayName] = useState('');
  const { port, setPort, refusal: offerRefusal } = useOfferedPort();
  const [refusals, setRefusals] = useState<DraftRefusals>({});
  const saveGateway = useSaveGateway();

  function save() {
    const refused = refusalsBeforeSaving(displayName, port);

    if (refused.name !== undefined || refused.port !== undefined) {
      setRefusals(refused);

      return;
    }

    const slug = slugFromName(displayName);

    saveGateway.mutate(gatewayFrom(displayName, slug, port), {
      onSuccess: () => {
        onOpenChange(false);
        onCreated(slug);
      },
      onError: (failure) => {
        setRefusals(refusalFromMain(failure));
      },
    });
  }

  return {
    displayName,
    port,
    refusals: { ...refusals, sheet: refusals.sheet ?? offerRefusal },
    save,
    saving: saveGateway.isPending,
    changeName: (typed: string) => {
      setDisplayName(typed);
      setRefusals((held) => ({ ...held, name: undefined }));
    },
    changePort: (typed: string) => {
      setPort(typed);
      setRefusals((held) => ({ ...held, port: undefined }));
    },
  };
}
