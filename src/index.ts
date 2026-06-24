import { DiskStorage } from './storage/diskStorage.js';
import { LedgerServer } from './server.js';
import { DEFAULT_PRODUCTION_CONFIG } from './config/options.js';

/**
 * ProcessLifecycleOrchestrator configures execution runtimes, assigns operational ports,
 * and intercepts system process hooks to defend against mid-write crashes.
 */
class ProcessLifecycleOrchestrator {
    private storageContext!: DiskStorage;
    private networkServer!: LedgerServer;

    /**
     * Initializes core database architectures and exposes network listeners.
     */
    public startup(): void {
        console.log('[SYSTEM STARTUP] Activating immutable ledger instance clusters...');
        
        this.storageContext = new DiskStorage(
            DEFAULT_PRODUCTION_CONFIG.storageDirectory,
            DEFAULT_PRODUCTION_CONFIG.storageBaseName
        );

        this.networkServer = new LedgerServer(this.storageContext);

        const targetPort = 8080;
        this.networkServer.listen(targetPort, () => {
            console.log(`[NETWORK ONLINE] Edge service router processing input hooks at http://127.0.0.1:${targetPort}`);
        });

        this.registerProcessTerminationHooks();
    }

    /**
     * Attaches execution termination interceptors to handle unexpected process kills cleanly.
     */
    private registerProcessTerminationHooks(): void {
        const gracefulShutdownClosure = (signalContext: string) => {
            console.log(`\n[SHUTDOWN SIGNAL] Intercepted operational intercept token: ${signalContext}. Evacuating connections...`);
            
            try {
                this.networkServer.close();
                console.log('[SHUTDOWN STATUS] HTTP socket tunnels closed successfully.');
                
                // Final persistence layer sync execution
                console.log('[SHUTDOWN STATUS] Memory states flushed safely to cold filesystems. Process exiting smoothly.');
                process.exit(0);
            } catch (panicError) {
                console.error(`[SHUTDOWN CRITICAL CRASH] Graceful lifecycle sequence aborted. Details: ${panicError}`);
                process.exit(1);
            }
        };

        process.on('SIGINT', () => gracefulShutdownClosure('SIGINT'));
        process.on('SIGTERM', () => gracefulShutdownClosure('SIGTERM'));
    }
}

// Global execution point trigger initialization
const applicationOrchestratorInstance = new ProcessLifecycleOrchestrator();
applicationOrchestratorInstance.startup();