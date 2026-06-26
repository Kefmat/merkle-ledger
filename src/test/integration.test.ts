import { describe, it } from 'node:test';
import assert from 'node:assert';
import { MerkleMountainRange } from '../mmr/mmr.js';
import { DiskStorage } from '../storage/diskStorage.js';
import { CryptographicProofVerifier } from '../crypto/verifier.js';

/**
 * EndToEndLifecycleSimulation covers critical workflows across ledger ingestion,
 * tracking, proof production, and independent client validation layers.
 */
describe('Merkle Ledger Core Integration Suite', () => {
    it('should complete a multi-step append, proof extraction, and out-of-band validation flow', () => {
        // Instantiate real storage context to satisfy constructor requirements
        const mockStorageInstance = new DiskStorage('./data/test_env', 'integration_manifest');
        const testEngineInstance = new MerkleMountainRange(mockStorageInstance);
        
        const txA = 'tx_commitment_payload_alpha';
        const txB = 'tx_commitment_payload_beta';
        
        const trackingIndexA = testEngineInstance.appendLeaf(txA);
        testEngineInstance.appendLeaf(txB);
        
        // Provide both tracking index and raw value parameters to clear TS2554
        const proofBundle = testEngineInstance.generateInclusionProof(trackingIndexA, txA);
        const engineActivePeaks = testEngineInstance.getPeakHashes();

        const isValidationSuccessful = CryptographicProofVerifier.verifyInclusionPath(
            txA,
            trackingIndexA,
            proofBundle.siblings,
            engineActivePeaks
        );

        assert.strictEqual(isValidationSuccessful, true, 'The out-of-band mathematical evaluation must validate matching trees.');
    });
});