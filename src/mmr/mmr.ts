import { createHash } from 'crypto';
import { MemoryStorage } from '../storage/memoryStorage.js';
import { MathUtilities } from './math.js';
import { InclusionProof, ConsistencyProof } from '../types/index.js';

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
    private readonly leafToStorageMap: Map<number, number> = new Map();
    private leafCount: number = 0;

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
     * @returns The chronological leaf index assigned to the newly appended leaf.
     */
    public appendLeaf(value: string): number {
        const currentHash = this.calculateHash(value);
        const currentHeight = 0;
        const assignedLeafIndex = this.leafCount;
        const assignedStorageIndex = this.nextStorageIndex;

        this.leafToStorageMap.set(assignedLeafIndex, assignedStorageIndex);
        this.storage.writeNode(assignedStorageIndex, currentHash);
        
        let newPeak: PeakMarker = {
            storageIndex: assignedStorageIndex,
            height: currentHeight,
            hash: currentHash
        };
        this.nextStorageIndex++;
        this.leafCount++;

        // Cascading merge loop: combine left and right peaks of equal height
        while (this.peaks.length > 0 && this.peaks[this.peaks.length - 1].height === newPeak.height) {
            const leftPeak = this.peaks.pop()!;
            const parentHash = this.calculateHash(leftPeak.hash + newPeak.hash);
            const parentIndex = this.nextStorageIndex;
            
            this.storage.writeNode(parentIndex, parentHash);
            this.nextStorageIndex++;

            newPeak = {
                storageIndex: parentIndex,
                height: leftPeak.height + 1,
                hash: parentHash
            };
        }

        this.peaks.push(newPeak);
        return assignedLeafIndex;
    }

    /**
     * Generates a verifiable cryptographic proof capsule demonstrating leaf inclusion.
     * @param leafIndex The chronological leaf position identifier to verify.
     * @param rawValue The original unhashed string payload backing the leaf reference.
     * @returns A complete InclusionProof token structure.
     * @throws Error if the specified leaf index does not map to an allocated element.
     */
    public generateInclusionProof(leafIndex: number, rawValue: string): InclusionProof {
        const initialStorageIndex = this.leafToStorageMap.get(leafIndex);
        if (initialStorageIndex === undefined) {
            throw new Error(`Inclusion proof execution error: Leaf index ${leafIndex} is out of bounds.`);
        }

        const siblingsCollection: string[] = [];
        let currentStorageIndex = initialStorageIndex;
        let currentHeight = MathUtilities.getNodeHeight(currentStorageIndex);

        // Climb the tree path until reaching an isolated mountain peak
        while (currentStorageIndex < this.nextStorageIndex) {
            const siblingIndex = MathUtilities.getSiblingIndex(currentStorageIndex, currentHeight);
            const siblingHash = this.storage.readNode(siblingIndex);
            
            if (!siblingHash) {
                break; // Sibling is unallocated, indicating we hit a peak root boundary
            }

            siblingsCollection.push(siblingHash);
            
            // Determine parent index coordinate sequentially under post-order rules
            if (siblingIndex > currentStorageIndex) {
                currentStorageIndex = siblingIndex + 1;
            } else {
                currentStorageIndex = currentStorageIndex + 1;
            }
            currentHeight++;
        }

        return {
            leafIndex,
            leafValue: rawValue,
            siblings: siblingsCollection,
            peakHashes: this.getPeakHashes()
        };
    }

    /**
     * Extracts the proof context tokens required to demonstrate structural consistency.
     * Simulates historical operations to construct the precise baseline peaks configuration.
     * @param oldSize The total record volume defining the historical reference point.
     * @returns A populated ConsistencyProof capsule containing evaluation parameters.
     */
    public generateConsistencyProof(oldSize: number): ConsistencyProof {
        if (oldSize <= 0 || oldSize > this.leafCount) {
            throw new Error(`Consistency proof calculation exception: Baseline bounds size ${oldSize} is invalid.`);
        }

        // Reconstruct what the peaks array looked like when leafCount matched oldSize
        let virtualPeaks: Array<{ height: number; hash: string }> = [];
        
        for (let i = 0; i < oldSize; i++) {
            const leafStorageIdx = this.leafToStorageMap.get(i);
            if (leafStorageIdx === undefined) {
                continue;
            }
            const initialHash = this.storage.readNode(leafStorageIdx);
            if (!initialHash) {
                continue;
            }

            let newVirtualPeak = { height: 0, hash: initialHash };

            while (virtualPeaks.length > 0 && virtualPeaks[virtualPeaks.length - 1].height === newVirtualPeak.height) {
                const leftVirtualPeak = virtualPeaks.pop()!;
                const parentHash = this.calculateHash(leftVirtualPeak.hash + newVirtualPeak.hash);
                newVirtualPeak = {
                    height: leftVirtualPeak.height + 1,
                    hash: parentHash
                };
            }
            virtualPeaks.push(newVirtualPeak);
        }

        const historicalProofHashes = virtualPeaks.map(vp => vp.hash);

        return {
            oldSize,
            newSize: this.leafCount,
            proofHashes: historicalProofHashes
        };
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

        if (this.peaks.length === 1) {
            return this.peaks[0].hash;
        }

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
        return this.peaks.map((p: PeakMarker) => p.hash);
    }

    /**
     * Returns the total count of appended leaf nodes currently managed by the range.
     * @returns The total number of leaves.
     */
    public getLeafCount(): number {
        return this.leafCount;
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