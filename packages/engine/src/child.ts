import { attachEngineChild } from './engine-child';
import { openGatewayListeners } from './gateway-listener';
import { readParentPort } from './parent-port';

attachEngineChild(readParentPort(process), openGatewayListeners);
