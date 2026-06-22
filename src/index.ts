import { MemoryStorage } from './storage/memoryStorage.js';
import { LedgerServer } from './server.js';

/**
 * Service initialization pipeline binding internal components to active interface descriptors.
 */
function bootMicroserviceInstance(): void {
    console.log('Orchestrating internal cryptographic accumulator storage maps...');
    
    const persistentMemoryStore = new MemoryStorage();
    const runtimeHttpDaemon = new LedgerServer(persistentMemoryStore);
    const targetNetworkPort = 8088;

    runtimeHttpDaemon.listen(targetNetworkPort, () => {
        console.log(`Secured auditing layer operational across network interfaces. Daemon running on port: ${targetNetworkPort}`);
    });

    /**
     * Handles standard operating system termination traps to release port allocations.
     */
    const executionTeardownTrap = (): void => {
        console.log('\nIntercepted process shutdown trigger. Disposing open server network interfaces...');
        runtimeHttpDaemon.close();
        console.log('Teardown complete. Exiting thread execution clean.');
        process.exit(0);
    };

    // Register active process boundary signal event monitors
    process.on('SIGINT', executionTeardownTrap);
    process.on('SIGTERM', executionTeardownTrap);
}

bootMicroserviceInstance();