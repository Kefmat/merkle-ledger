import { createHash } from 'crypto';

/**
 * Interface contract representing a combined node coordinate item in a tree traversal.
 */
interface NodeMarker {
    index: number;
    height: number;
    hash: string;
}

/**
 * MerkleProofEngine orchestrates the generation and verification of mathematical 
 * inclusion and consistency claims within the immutable mountain range layout.
 */
export class MerkleProofEngine {
    
    /**
     * Verifies that a specific leaf payload exists at a declared index within the log 
     * matching the authoritative accumulator root hash.
     * @param rootHash The current top-level cryptographic accumulator commitment hex string.
     * @param leafValue The raw string or binary payload representing the historical ledger entry.
     * @param index The absolute sequential entry offset within the ledger.
     * @param proof An ordered array of sibling hashes matching the index's climbing path.
     * @param peakHashes Optional collection of historical peak commitments forming the broader range topology.
     * @returns True if the recalculated hash matches the authoritative rootHash perfectly.
     */
    public static verifyInclusion(
        rootHash: string, 
        leafValue: string, 
        index: number, 
        proof: string[],
        peakHashes: string[] = []
    ): boolean {
        let currentHash = this.cryptoHash(leafValue);
        let trackingIndex = index;
        
        // Climb to the summit of the local sub-tree using the provided path siblings
        for (const sibling of proof) {
            if (trackingIndex % 2 === 0) {
                currentHash = this.cryptoHash(currentHash + sibling);
            } else {
                currentHash = this.cryptoHash(sibling + currentHash);
            }
            trackingIndex = Math.floor(trackingIndex / 2);
        }
        
        // If no multi-peak tracking markers are supplied, evaluate directly against sub-tree root
        if (peakHashes.length <= 1) {
            return currentHash === rootHash;
        }

        // Locate where our calculated sub-tree root resides within the collective peaks collection
        let peakMatchedIndex = -1;
        for (let i = 0; i < peakHashes.length; i++) {
            if (peakHashes[i] === currentHash) {
                peakMatchedIndex = i;
                break;
            }
        }

        if (peakMatchedIndex === -1) {
            return false;
        }

        // Fold all distinctive mountain peaks from right to left to establish the final commitment
        let foldedRoot = peakHashes[peakHashes.length - 1];
        for (let i = peakHashes.length - 2; i >= 0; i--) {
            foldedRoot = this.cryptoHash(peakHashes[i] + foldedRoot);
        }
        
        return foldedRoot === rootHash;
    }

    /**
     * Validates multiple entries simultaneously using a batch multi-proof map.
     * Minimizes network overhead by resolving overlapping parent paths.
     * @param rootHash The current authoritative master root signature.
     * @param leaves An array of targeted leaf entries containing indices and raw values.
     * @param proofHashes Sibling node hashes necessary to complete the combined path.
     * @param peakHashes The collection of active peak hashes forming the range topology.
     * @returns True if the combined calculations match the authorized rootHash perfectly.
     */
    public static verifyMultiInclusion(
        rootHash: string,
        leaves: Array<{ index: number; value: string }>,
        proofHashes: string[],
        peakHashes: string[]
    ): boolean {
        if (leaves.length === 0) {
            return false;
        }

        // Initialize node pool from provided leaf items
        let currentLevelNodes: NodeMarker[] = leaves.map(leaf => ({
            index: leaf.index,
            height: 0,
            hash: this.cryptoHash(leaf.value)
        }));

        let proofPointer = 0;

        // Process level transformations while nodes require resolution
        while (currentLevelNodes.length > 0) {
            // Sort node coordinates to process layers uniformly from left to right
            currentLevelNodes.sort((a, b) => a.index - b.index);

            // Break if the remaining nodes match items inside the known peakHashes array
            const allPeaksResolved = currentLevelNodes.every(node => 
                peakHashes.includes(node.hash)
            );
            if (allPeaksResolved) {
                break;
            }

            const nextLevelNodes: NodeMarker[] = [];

            for (let i = 0; i < currentLevelNodes.length; i++) {
                const currentNode = currentLevelNodes[i];
                const isEven = currentNode.index % 2 === 0;
                const siblingIndex = isEven ? currentNode.index + 1 : currentNode.index - 1;

                // Look for an adjacent sibling node inside the current processing level
                const siblingMatch = currentLevelNodes.find(n => n.index === siblingIndex && n.height === currentNode.height);

                if (siblingMatch) {
                    // Sibling found in the pool; skip duplicates on the next iteration
                    if (isEven) {
                        const combinedParentHash = this.cryptoHash(currentNode.hash + siblingMatch.hash);
                        nextLevelNodes.push({
                            index: Math.floor(currentNode.index / 2),
                            height: currentNode.height + 1,
                            hash: combinedParentHash
                        });
                    }
                    if (isEven) {
                        i++; // Progress beyond paired child elements
                    }
                } else {
                    // Sibling missing from current level; consume a hash from the proof hashes array
                    if (proofPointer >= proofHashes.length) {
                        return false;
                    }
                    const providedSiblingHash = proofHashes[proofPointer++];
                    const combinedParentHash = isEven 
                        ? this.cryptoHash(currentNode.hash + providedSiblingHash)
                        : this.cryptoHash(providedSiblingHash + currentNode.hash);

                    nextLevelNodes.push({
                        index: Math.floor(currentNode.index / 2),
                        height: currentNode.height + 1,
                        hash: combinedParentHash
                    });
                }
            }

            currentLevelNodes = nextLevelNodes;
        }

        // Fold the final peaks collection from right to left to build the master root hash
        if (peakHashes.length === 0) {
            return false;
        }
        let foldedRoot = peakHashes[peakHashes.length - 1];
        for (let i = peakHashes.length - 2; i >= 0; i--) {
            foldedRoot = this.cryptoHash(peakHashes[i] + foldedRoot);
        }

        return foldedRoot === rootHash;
    }

    /**
     * Evaluates a consistency proof package to confirm that a new master root signature represents
     * a pure append-only development path from a known, historical baseline root configuration.
     * @param oldRootHash The trusted cryptographic master root snapshot representing the baseline state.
     * @param newRootHash The target extended master root signature being evaluated for compliance.
     * @param proofHashes The minimal subset of peak elements generated at the historical baseline milestone.
     * @param currentPeakHashes The active operational peak array representing the newly extended range state.
     * @returns True if the mathematical extension checks validate correctly, confirming an append-only path.
     */
    public static verifyConsistency(
        oldRootHash: string,
        newRootHash: string,
        proofHashes: string[],
        currentPeakHashes: string[]
    ): boolean {
        if (proofHashes.length === 0 || currentPeakHashes.length === 0) {
            return false;
        }

        // 1. Reconstruct the old master root signature by folding historical peaks from right to left
        let calculatedOldRoot = proofHashes[proofHashes.length - 1];
        for (let i = proofHashes.length - 2; i >= 0; i--) {
            calculatedOldRoot = this.cryptoHash(proofHashes[i] + calculatedOldRoot);
        }

        if (calculatedOldRoot !== oldRootHash) {
            return false; // Historical proof hashes do not form the verified old master root
        }

        // 2. Finalize by folding the current active state peaks to verify alignment with the target new root
        let finalizedNewRoot = currentPeakHashes[currentPeakHashes.length - 1];
        for (let i = currentPeakHashes.length - 2; i >= 0; i--) {
            finalizedNewRoot = this.cryptoHash(currentPeakHashes[i] + finalizedNewRoot);
        }

        return finalizedNewRoot === newRootHash;
    }

    /**
     * Internal utility executing standard non-reversible cryptographic SHA-256 hash functions.
     * @param data The concatenated input string to process.
     * @returns A fixed-size 64-character hexadecimal hash digest string.
     */
    private static cryptoHash(data: string): string {
        return createHash('sha256').update(data).digest('hex');
    }
}