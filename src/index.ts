import { MemoryStorage } from './storage/memoryStorage.js';
import { LedgerServer } from './server.js';

/**
 * Service initialization pipeline binding internal components to active interface descriptors.
 */
function bootMicroserviceInstance(): void {
    console.log('Orchestrating internal cryptographic accumulator storage maps...');
    
    const persistentMemoryStore = new MemoryStorage();
    const runtimeHttpDaemon = new LedgerServer(persistentMemoryStore);
    
    const targetNetworkPort = 8080;

    runtimeHttpDaemon.listen(targetNetworkPort, () => {
        console.log(`Secured auditing layer operational across network interfaces. Daemon running on port: ${targetNetworkPort}`);
    });
}

bootMicroserviceInstance();