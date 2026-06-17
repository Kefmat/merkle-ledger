import { MemoryStorage } from './storage/memoryStorage.js';
import { MerkleMountainRange } from './mmr/mmr.js';
import { MerkleProofEngine } from './proofs/engine.js';

/**
 * Execution entry point to demonstrate and test the cryptographic safety invariants 
 * of the Merkle Mountain Range tracking system.
 */
function runLedgerVerificationPipeline(): void {
    console.log('Initializing cryptographic COMSEC ledger component architectures...');

    const storageEngine = new MemoryStorage();
    const ledger = new MerkleMountainRange(storageEngine);

    // Append mock high-integrity operational logs to the structure
    ledger.appendLeaf('TX_LOG_ENTRY_001: SYSTEM_INIT');
    ledger.appendLeaf('TX_LOG_ENTRY_002: KEY_ROTATION_ROT_01');
    ledger.appendLeaf('TX_LOG_ENTRY_003: ACCESS_GRANTED_ZONE_ALPHA');
    ledger.appendLeaf('TX_LOG_ENTRY_004: DEVICE_PROVISION_SECURE');

    const masterRootHash = ledger.getMasterRoot();
    console.log(`Current Authoritative Master Root: ${masterRootHash}`);

    // Simulate an inclusion proof scenario for TX_LOG_ENTRY_004
    const leafValue = 'TX_LOG_ENTRY_004: DEVICE_PROVISION_SECURE';
    
    // In a production setup, these sibling indices are mapped mathematically.
    // For this initial simulation scenario, we pass an empty tracking slice.
    const mockedProofSiblings: string[] = []; 
    
    // Validate integrity parameters using the static proof verification engine
    const isValid = MerkleProofEngine.verifyInclusion(
        masterRootHash,
        leafValue,
        0, // Base verification offset relative to local peak coordinates
        mockedProofSiblings
    );

    console.log(`Execution Complete. Cryptographic inclusion match state: ${isValid}`);
}

runLedgerVerificationPipeline();