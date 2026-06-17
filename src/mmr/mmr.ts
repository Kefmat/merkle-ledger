import { createHash } from 'crypto';
import { MemoryStorage } from '../storage/memoryStorage.js';

/**
 * Tracks the metadata of an active peak within the mountain range topology.
 */
interface PeakMarker {
    /** The absolute flat serialization index inside the storage system. */
    storageIndex: number;
    /** The height of the peak. A raw leaf resides at height 0. */
    height: number;
    /** The SHA-256 cryptographic hash calculated for this peak. */
    hash: string;
}

/**
 * MerkleMountainRange handles the incremental allocation of leaf nodes and orchestrates
 * the cascading merges required to maintain historical consistency and immutability.
 */
export class MerkleMountainRange {
    private readonly storage: MemoryStorage;
    private peaks: PeakMarker[] = [];
    private nextStorageIndex: number = 0;

    /**
     * Instantiates the Merkle Mountain Range with an underlying persistence layer.
     * @param storage The index-addressable storage implementation.
     */
    constructor(storage: MemoryStorage) {
        this.storage = storage;
    }

    /**
     * Appends a new unhashed payload entry as a leaf node to the end of the ledger.
     * Triggers cascading parent merges if the preceding peaks have matching heights.
     * @param value The raw string transaction or event data log.
     * @returns The storage index assigned to the newly appended leaf.
     */
    public appendLeaf(value: string): number {
        let currentHash = this.calculateHash(value);
        let currentHeight = 0;
        const initialLeafIndex = this.nextStorageIndex;

        // Persist the initial leaf node directly to the storage layout
        this.storage.writeNode(this.nextStorageIndex, currentHash);
        
        let newPeak: PeakMarker = {
            storageIndex: this.nextStorageIndex,
            height: currentHeight,
            hash: currentHash
        };
        this.nextStorageIndex++;

        // Cascading merge loop: combine left and right peaks of equal height
        while (this.peaks.length > 0 && this.peaks[this.peaks.length - 1].height === newPeak.height) {
            const leftPeak = this.peaks.pop()!;
            
            // Calculate parent node values based on binary concatenations
            const parentHash = this.calculateHash(leftPeak.hash + newPeak.hash);
            const parentIndex = this.nextStorageIndex;
            
            this.storage.writeNode(parentIndex, parentHash);
            this.nextStorageIndex++;

            // Move up one level in height and continue verification checks
            newPeak = {
                storageIndex: parentIndex,
                height: leftPeak.height + 1,
                hash: parentHash
            };
        }

        this.peaks.push(newPeak);
        return initialLeafIndex;
    }

    /**
     * Calculates the master root hash by aggregating all active mountain peaks.
     * If multiple peaks exist, they are combined from right to left to produce a single fingerprint.
     * @returns A 64-character hexadecimal string representing the overall state commitment.
     */
    public getMasterRoot(): string {
        if (this.peaks.length === 0) {
            return this.calculateHash('');
        }

        // If a single perfect binary tree exists, its peak is the master root
        if (this.peaks.length === 1) {
            return this.peaks[0].hash;
        }

        // Combine all distinct peak markers to bind the entire topology
        let dynamicRoot = this.peaks[this.peaks.length - 1].hash;
        for (let i = this.peaks.length - 2; i >= 0; i--) {
            dynamicRoot = this.calculateHash(this.peaks[i].hash + dynamicRoot);
        }

        return dynamicRoot;
    }

    /**
     * Generates a structural snapshot array of all active peak hashes for out-of-band validation.
     * @returns An ordered array of hexadecimal hash strings.
     */
    public getPeakHashes(): string[] {
        return this.peaks.map(p => p.hash);
    }

    /**
     * Internal utility executing standard non-reversible cryptographic SHA-256 hash functions.
     * @param data The concatenated input string to process.
     * @returns A fixed-size 64-character hexadecimal hash digest string.
     */
    private calculateHash(data: string): string {
        return createHash('sha256').update(data).digest('hex');
    }
}