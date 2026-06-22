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

    test('should safely throw an error when generating inclusion proofs on an empty ledger', () => {
        const storage = new MemoryStorage();
        const ledger = new MerkleMountainRange(storage);
        
        assert.throws(() => {
            ledger.generateInclusionProof(0, 'EMPTY_VAL');
        }, /The ledger contains zero entries/);
    });

    test('should safely throw an error when generating consistency proofs on an empty ledger', () => {
        const storage = new MemoryStorage();
        const ledger = new MerkleMountainRange(storage);
        
        assert.throws(() => {
            ledger.generateConsistencyProof(1);
        }, /The ledger contains zero entries/);
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

    test('should correctly validate legitimate consistency proofs across size extensions', () => {
        const storage = new MemoryStorage();
        const ledger = new MerkleMountainRange(storage);

        ledger.appendLeaf('TX_001');
        ledger.appendLeaf('TX_002');
        const baselineRoot = ledger.getMasterRoot();

        ledger.appendLeaf('TX_003');
        ledger.appendLeaf('TX_004');
        ledger.appendLeaf('TX_005');
        const extendedRoot = ledger.getMasterRoot();

        const consistencyProof = ledger.generateConsistencyProof(2);

        const isValidExtension = MerkleProofEngine.verifyConsistency(
            baselineRoot,
            extendedRoot,
            consistencyProof.proofHashes,
            ledger.getPeakHashes()
        );

        assert.strictEqual(isValidExtension, true);
    });

    test('should validate batch operations matching multi-inclusion structural invariants', () => {
        const storage = new MemoryStorage();
        const ledger = new MerkleMountainRange(storage);

        // Appending 4 leaves produces a single perfect subtree with a root peak at storage index 6
        ledger.appendLeaf('TX_BATCH_01'); // Storage index 0
        ledger.appendLeaf('TX_BATCH_02'); // Storage index 1
        ledger.appendLeaf('TX_BATCH_03'); // Storage index 3
        ledger.appendLeaf('TX_BATCH_04'); // Storage index 4

        const masterRoot = ledger.getMasterRoot();
        const peakHashes = ledger.getPeakHashes();

        // Target two sibling leaves that share a known parent node inside the tree topology
        const monitoredLeaves = [
            { index: 0, value: 'TX_BATCH_01' },
            { index: 1, value: 'TX_BATCH_02' }
        ];

        // Retrieve the proof for leaf 0 to extract the path siblings needed to climb the remaining tree levels
        const subProof = ledger.generateInclusionProof(0, 'TX_BATCH_01');
        
        // Since indices 0 and 1 pair perfectly at height 0, their parent hash is resolved locally.
        // We supply the subsequent sibling hashes from the proof path to satisfy the higher levels.
        const requiredProofHashes = subProof.siblings.slice(1);

        const isValidBatch = MerkleProofEngine.verifyMultiInclusion(
            masterRoot,
            monitoredLeaves,
            requiredProofHashes,
            peakHashes
        );

        assert.strictEqual(isValidBatch, true);
    });
});