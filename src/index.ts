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

    // Append high-integrity operational logs to the structure
    ledger.appendLeaf('TX_LOG_ENTRY_001: SYSTEM_INIT');
    ledger.appendLeaf('TX_LOG_ENTRY_002: KEY_ROTATION_ROT_01');
    ledger.appendLeaf('TX_LOG_ENTRY_003: ACCESS_GRANTED_ZONE_ALPHA');
    
    // Track the index of the specific leaf we wish to audit
    const targetLeafIndex = ledger.appendLeaf('TX_LOG_ENTRY_004: DEVICE_PROVISION_SECURE');
    const leafValue = 'TX_LOG_ENTRY_004: DEVICE_PROVISION_SECURE';

    const masterRootHash = ledger.getMasterRoot();
    console.log(`Current Authoritative Master Root: ${masterRootHash}`);

    console.log(`Generating authentic cryptographic inclusion proof for leaf index: ${targetLeafIndex}...`);
    
    // Generate a valid, non-mocked inclusion proof token using the upgraded MMR engine
    const inclusionProof = ledger.generateInclusionProof(targetLeafIndex, leafValue);

    console.log(`Proof generated successfully. Number of sibling hashes collected: ${inclusionProof.siblings.length}`);
    inclusionProof.siblings.forEach((hash: string, idx: number) => {
        console.log(`  Sibling [${idx}]: ${hash}`);
    });

    console.log('Passing proof package to the static MerkleProofEngine for structural verification...');

    // Validate integrity parameters using the static proof verification engine passing peak markers
    const isValid = MerkleProofEngine.verifyInclusion(
        masterRootHash,
        inclusionProof.leafValue,
        inclusionProof.leafIndex,
        inclusionProof.siblings,
        inclusionProof.peakHashes
    );

    console.log(`Execution Complete. Cryptographic inclusion match state: ${isValid}`);
}

runLedgerVerificationPipeline();