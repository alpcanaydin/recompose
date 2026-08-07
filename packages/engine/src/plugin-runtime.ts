import { PluginHost } from './plugin-host';
import { discoverInstalledPlugins } from './plugin-install';

export async function loadInstalledPluginHost(directory: string | undefined): Promise<PluginHost> {
  const host = new PluginHost();
  const root = directory?.trim();

  if (emptyDirectory(root)) return host;

  const installed = await discoverInstalledPlugins(root);

  await Promise.all(installed.map(async (plugin) => loadInstalledPlugin(host, plugin)));

  return host;
}

function emptyDirectory(directory: string | undefined): directory is undefined | '' {
  return directory === undefined || directory === '';
}

async function loadInstalledPlugin(
  host: PluginHost,
  plugin: { id: string; path: string },
): Promise<void> {
  try {
    await host.load(plugin.id, plugin.path);
  } catch (failure) {
    console.error(`recompose could not load plugin "${plugin.id}"`, failure);
  }
}
