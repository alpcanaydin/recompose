import { useEffect, useRef } from 'react';

import { firstLiveControl } from '../lib/first-live-control';
import { AppearanceSection } from './appearance-section';
import { DataSection } from './data-section';
import { GeneralSection } from './general-section';
import { ServerSection } from './server-section';

type SettingsPageProps = {
  /** Set by the settings shortcut, whose keyboard route has to land somewhere. */
  focus?: 'first-control' | undefined;
};

/** Every stored setting on one scrollable column, applied the moment it changes. */
export function SettingsPage({ focus }: SettingsPageProps) {
  const surface = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focus === undefined) {
      return;
    }

    firstLiveControl(surface.current)?.focus();
  }, [focus]);

  return (
    <div className="mx-auto flex w-full max-w-column flex-col gap-5" ref={surface}>
      <h1 className="text-title text-ink">Settings</h1>
      <GeneralSection />
      <ServerSection />
      <AppearanceSection />
      <DataSection />
    </div>
  );
}
