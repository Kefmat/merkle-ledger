import { createHash } from 'crypto';

/**
 * MerkleProofEngine orchestrates the generation and verification of mathematical 
 * inclusion claims within the immutable mountain range layout.
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
     * Internal utility executing standard non-reversible cryptographic SHA-256 hash functions.
     * @param data The concatenated input string to process.
     * @returns A fixed-size 64-character hexadecimal hash digest string.
     */
    private static cryptoHash(data: string): string {
        return createHash('sha256').update(data).digest('hex');
    }
}