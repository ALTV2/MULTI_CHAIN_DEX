// Side-effect import: registers the SUI chain adapter into the global registry
import { chainRegistry } from '../registry';
import { SuiChainAdapter } from './SuiChainAdapter';

const suiAdapter = new SuiChainAdapter();
chainRegistry.register('sui:testnet', suiAdapter);

export { suiAdapter };
