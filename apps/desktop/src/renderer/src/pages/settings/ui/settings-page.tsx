import { AppearanceSection } from './appearance-section';
import { DataSection } from './data-section';
import { GeneralSection } from './general-section';
import { ServerSection } from './server-section';

/** Every stored setting on one scrollable column, applied the moment it changes. */
export function SettingsPage() {
  return (
    <div className="mx-auto flex w-full max-w-column flex-col gap-5">
      <h1 className="text-title text-ink">Settings</h1>
      <GeneralSection />
      <ServerSection />
      <AppearanceSection />
      <DataSection />
    </div>
  );
}
