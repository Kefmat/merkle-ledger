import { test, describe } from 'node:test';
import assert from 'node:assert';
import { MemoryStorage } from '../storage/memoryStorage.js';
import { MerkleMountainRange } from '../mmr/mmr.js';
import { MerkleProofEngine } from '../proofs/engine.js';

describe('Merkle Mountain Range Cryptographic Suite', () => {

    test('should maintain immutability and reject index modification overwrites', () => {
        const storage = new MemoryStorage();
        storage.writeNode(10, '8a3c61b1');
        
        assert.throws(() => {
            storage.writeNode(10, 'ffffffff');
        }, /Persistence invariant violation/);
    });

    test('should accurately verify authentic inclusion proofs for arbitrary entries', () => {
        const storage = new MemoryStorage();
        const ledger = new MerkleMountainRange(storage);

        ledger.appendLeaf('RECORD_001');
        const targetIndex = ledger.appendLeaf('RECORD_002');
        ledger.appendLeaf('RECORD_003');
        ledger.appendLeaf('RECORD_004');

        const masterRoot = ledger.getMasterRoot();
        const rawPayload = 'RECORD_002';
        const proof = ledger.generateInclusionProof(targetIndex, rawPayload);

        const isVerified = MerkleProofEngine.verifyInclusion(
            masterRoot,
            proof.leafValue,
            proof.leafIndex,
            proof.siblings,
            proof.peakHashes
        );

        assert.strictEqual(isVerified, true);
    });

    test('should reject inclusion matching if the data payload has been altered', () => {
        const storage = new MemoryStorage();
        const ledger = new MerkleMountainRange(storage);

        ledger.appendLeaf('SYSTEM_STATE_NORMAL');
        const targetIndex = ledger.appendLeaf('AUTHENTIC_PAYLOAD');
        ledger.appendLeaf('SYSTEM_STATE_TERMINAL');

        const masterRoot = ledger.getMasterRoot();
        const proof = ledger.generateInclusionProof(targetIndex, 'AUTHENTIC_PAYLOAD');

        // Execute a simulated intercept modification attack by passing forged data
        const isVerifiedWithTamperedData = MerkleProofEngine.verifyInclusion(
            masterRoot,
            'FORGED_TAMPERED_PAYLOAD',
            proof.leafIndex,
            proof.siblings,
            proof.peakHashes
        );

        assert.strictEqual(isVerifiedWithTamperedData, false);
    });

    test('should reject verification claims if a sibling path token is corrupted', () => {
        const storage = new MemoryStorage();
        const ledger = new MerkleMountainRange(storage);

        ledger.appendLeaf('LOG_ALPHA');
        const targetIndex = ledger.appendLeaf('LOG_BETA');
        ledger.appendLeaf('LOG_GAMMA');

        const masterRoot = ledger.getMasterRoot();
        const proof = ledger.generateInclusionProof(targetIndex, 'LOG_BETA');

        // Corrupt one historical sibling parameter within the tracking array
        if (proof.siblings.length > 0) {
            proof.siblings[0] = '0000000000000000000000000000000000000000000000000000000000000000';
        }

        const isVerifiedWithCorruptedPath = MerkleProofEngine.verifyInclusion(
            masterRoot,
            proof.leafValue,
            proof.leafIndex,
            proof.siblings,
            proof.peakHashes
        );

        assert.strictEqual(isVerifiedWithCorruptedPath, false);
    });
});