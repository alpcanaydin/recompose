import { attachEngineChild } from './engine-child';
import { openGatewayListeners } from './gateway-listener';
import { readParentPort } from './parent-port';
import { stayResident } from './stay-resident';

attachEngineChild(readParentPort(process), openGatewayListeners);
stayResident();
