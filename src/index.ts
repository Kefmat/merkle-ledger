import { MemoryStorage } from './storage/memoryStorage.js';
import { LedgerServer } from './server.js';

/**
 * Service initialization pipeline binding internal components to active interface descriptors.
 */
function bootMicroserviceInstance(): void {
    console.log('Orchestrating internal cryptographic accumulator storage maps...');
    
    const persistentMemoryStore = new MemoryStorage();
    const runtimeHttpDaemon = new LedgerServer(persistentMemoryStore);
    
    // Pivot to 8081 to bypass local system socket contention issues
    const targetNetworkPort = 8081;

    runtimeHttpDaemon.listen(targetNetworkPort, () => {
        console.log(`Secured auditing layer operational across network interfaces. Daemon running on port: ${targetNetworkPort}`);
    });
}

bootMicroserviceInstance();