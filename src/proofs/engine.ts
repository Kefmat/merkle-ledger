import { createHash } from 'crypto';

/**
 * MerkleProofEngine orchestrates the generation and verification of mathematical 
 * inclusion claims within the immutable mountain range layout.
 */
export class MerkleProofEngine {
    
    /**
     * Verifies that a specific leaf payload exists at a declared index within the log 
     * matching the authoritative accumulator root hash.
     * * @param rootHash The current top-level cryptographic accumulator commitment hex string.
     * @param leafValue The raw string or binary payload representing the historical ledger entry.
     * @param index The absolute sequential entry offset within the ledger.
     * @param proof An ordered array of sibling hashes matching the index's climbing path.
     * @returns True if the recalculated hash matches the authoritative rootHash perfectly.
     */
    public static verifyInclusion(
        rootHash: string, 
        leafValue: string, 
        index: number, 
        proof: string[]
    ): boolean {
        let currentHash = this.cryptoHash(leafValue);
        let trackingIndex = index;
        
        for (const sibling of proof) {
            // Check bitwise parity to see if current index is a left or right node
            if (trackingIndex % 2 === 0) {
                currentHash = this.cryptoHash(currentHash + sibling);
            } else {
                currentHash = this.cryptoHash(sibling + currentHash);
            }
            trackingIndex = Math.floor(trackingIndex / 2);
        }
        
        return currentHash === rootHash;
    }

    /**
     * Internal utility executing standard non-reversible cryptographic SHA-256 hash functions.
     * * @param data The concatenated input string to process.
     * @returns A fixed-size 64-character hexadecimal hash digest string.
     */
    private static cryptoHash(data: string): string {
        return createHash('sha256').update(data).digest('hex');
    }
}