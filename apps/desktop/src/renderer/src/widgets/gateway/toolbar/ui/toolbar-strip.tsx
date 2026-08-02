import type { GatewayEngineState } from '@recompose/contracts';

import { useSyncExternalStore } from 'react';

import { sidebarHidden, subscribeToSidebarVisibility } from '../../../../shared/lib';
import { SidebarToggle, ToolbarButton } from '../../../../shared/ui';
import { AddressPill } from './address-pill';

const GROUP =
  'inline-flex h-7.25 items-center gap-0.5 rounded-control border border-line-subtle bg-surface-raised p-0.5';

type ToolbarStripProps = {
  address: string;
  /** The gateway the strip acts on, spoken as the toolbar's own name. */
  name: string;
  onRun: () => void;
  port: number;
  running: boolean;
  status: GatewayEngineState['status'];
};

/** The strip itself, holding the run control, the address, and the four the reference draws. */
export function ToolbarStrip({ address, name, onRun, port, running, status }: ToolbarStripProps) {
  const away = useSyncExternalStore(subscribeToSidebarVisibility, sidebarHidden);

  return (
    <div
      aria-label={name}
      className={`app-no-drag flex h-toolbar items-center gap-2.5 pe-3.5 ${away ? 'ps-window-controls-width' : 'ps-3.5'}`}
      role="toolbar"
    >
      <SidebarToggle where="standing" />
      <ToolbarButton
        glyph={running ? 'stop' : 'play'}
        label={running ? 'Stop' : 'Start'}
        onPress={onRun}
        tone={running ? 'text-stopped' : 'text-running'}
        where="standing"
      />
      <ToolbarButton glyph="book" label="Docs" waitsFor="the guide" where="standing" />
      <AddressPill address={address} port={port} status={status} />
      <ToolbarButton glyph="tidy" label="Tidy the canvas" waitsFor="the canvas" where="standing" />
      <ToolbarButton
        glyph="json"
        label="View as JSON"
        waitsFor="the config view"
        where="standing"
      />
      <span className={GROUP}>
        <ToolbarButton
          glyph="panel-bottom"
          label="Request log"
          waitsFor="request logging"
          where="grouped"
        />
        <ToolbarButton
          glyph="panel-right"
          label="Inspector"
          waitsFor="the inspector"
          where="grouped"
        />
      </span>
    </div>
  );
}
