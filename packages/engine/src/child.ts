import { attachEngineChild } from './engine-child';
import { openGatewayListeners } from './gateway-listener';
import { readParentPort } from './parent-port';
import { loadInstalledPluginHost } from './plugin-runtime';
import { stayResident } from './stay-resident';

const plugins = await loadInstalledPluginHost(process.env['RECOMPOSE_PLUGIN_DIR']);

attachEngineChild(
  readParentPort(process),
  openGatewayListeners,
  globalThis.fetch,
  undefined,
  plugins,
);
stayResident();
