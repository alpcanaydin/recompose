import { useRef } from 'react';

import type { GatewayDraftProps } from './gateway-draft';

import { GatewayDraft } from './gateway-draft';

type CreateGatewaySheetProps = Omit<GatewayDraftProps, 'nameField'>;

/**
 * The form that names a gateway, gives it a slug, and picks the port it will answer on.
 *
 * @summary Reach for it from anywhere a person can ask for a gateway. It arrives with a free
 * port already filled in, previews the address live, and stays open carrying the sentence that
 * explains any refusal rather than throwing the draft away.
 */
export function CreateGatewaySheet({ open, onOpenChange, onCreated }: CreateGatewaySheetProps) {
  const nameField = useRef<HTMLInputElement>(null);

  return (
    <GatewayDraft
      key={String(open)}
      nameField={nameField}
      onCreated={onCreated}
      onOpenChange={onOpenChange}
      open={open}
    />
  );
}
