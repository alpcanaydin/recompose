import type { ElectronApplication } from '@playwright/test';

/**
 * Runs an application-menu item by its label.
 *
 * @summary Playwright drives no native menu, so a scenario that presses a shortcut reaches the
 * item the same way the keyboard would and runs the action hanging off it.
 */
export async function chooseMenuItem(app: ElectronApplication, label: string): Promise<void> {
  await app.evaluate(({ Menu }, wanted) => {
    type MenuItems = NonNullable<ReturnType<typeof Menu.getApplicationMenu>>['items'];

    const isMenuAction = (value: unknown): value is () => void => typeof value === 'function';

    const withNested = (items: MenuItems): MenuItems =>
      items.flatMap((item) => [item, ...withNested(item.submenu?.items ?? [])]);

    const applicationMenu = Menu.getApplicationMenu();

    if (applicationMenu === null) {
      throw new Error('the application menu is absent, so it carries no item to choose');
    }

    const chosen = withNested(applicationMenu.items).find((item) => item.label === wanted);

    if (chosen === undefined) {
      throw new Error(`the application menu carries no ${wanted} item`);
    }

    if (!isMenuAction(chosen.click)) {
      throw new Error(`the ${wanted} menu item carries no action to run`);
    }

    chosen.click();
  }, label);
}
