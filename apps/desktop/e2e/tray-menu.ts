import type { ElectronApplication, JSHandle } from '@playwright/test';

/** One line of a tray submenu, carrying whether the state leaves it reachable. */
export type TrayMenuEntry = {
  label: string;
  enabled: boolean;
};

export type TrayMenuProbe = {
  stands: () => boolean;
  submenuOf: (displayName: string) => TrayMenuEntry[];
  choose: (displayName: string, wanted: string) => void;
};

/**
 * Watches the menu the tray hands the operating system, and offers a way to run its items.
 *
 * @summary Playwright drives no native menu, so the scenario reads the menu recompose last
 * built. Installing this before the tray appears catches the first paint and every repaint after.
 */
export async function watchTrayMenu(app: ElectronApplication): Promise<JSHandle<TrayMenuProbe>> {
  return app.evaluateHandle(({ Tray }) => {
    type TrayMenu = Parameters<InstanceType<typeof Tray>['setContextMenu']>[0];
    type MenuSetter = (this: InstanceType<typeof Tray>, menu: TrayMenu) => void;

    const isMenuSetter = (value: unknown): value is MenuSetter => typeof value === 'function';

    const isMenuAction = (value: unknown): value is () => void => typeof value === 'function';

    const held: unknown = Reflect.get(Tray.prototype, 'setContextMenu');

    if (!isMenuSetter(held)) {
      throw new Error('the tray class carries no way to set a context menu');
    }

    let latest: TrayMenu = null;

    Tray.prototype.setContextMenu = function capture(
      this: InstanceType<typeof Tray>,
      menu: TrayMenu,
    ) {
      latest = menu;
      held.call(this, menu);
    };

    const submenuItems = (displayName: string) =>
      latest?.items.find((item) => item.label === displayName)?.submenu?.items ?? [];

    return {
      stands: () => latest !== null,
      submenuOf: (displayName: string) =>
        submenuItems(displayName).map((item) => ({ label: item.label, enabled: item.enabled })),
      choose: (displayName: string, wanted: string) => {
        const chosen = submenuItems(displayName).find((item) => item.label === wanted);

        if (chosen === undefined) {
          throw new Error(`the ${displayName} submenu carries no ${wanted} item`);
        }

        if (!chosen.enabled) {
          throw new Error(`the ${displayName} submenu shows ${wanted} as unavailable`);
        }

        if (!isMenuAction(chosen.click)) {
          throw new Error(`the ${wanted} item of the ${displayName} submenu runs nothing`);
        }

        chosen.click();
      },
    };
  });
}
