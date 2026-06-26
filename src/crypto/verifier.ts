import { createHash } from 'crypto';

/**
 * CryptographicProofVerifier isolates math validation procedures to evaluate Merkle 
 * proofs independently of local storage availability.
 */
export class CryptographicProofVerifier {
    /**
     * Recomputes an inclusion tree chain to check if a payload matches a known root hash.
     * @param targetLeafValue The raw transactional data to verify.
     * @param leafStorageIndex The structural position tracking point.
     * @param structuralSiblings Sibling hashes along the climbing tree path.
     * @param referencePeakHashes Current peaks representing the mountain range.
     * @returns True if the recomputed root matches the consensus peaks.
     */
    public static verifyInclusionPath(
        targetLeafValue: string,
        leafStorageIndex: number,
        structuralSiblings: string[],
        referencePeakHashes: string[]
    ): boolean {
        try {
            let runningHash = createHash('sha256').update(targetLeafValue).digest('hex');
            let workingIndex = leafStorageIndex;

            for (const siblingHash of structuralSiblings) {
                // Determine structural pairing arrangement under post-order traversal rules
                if (workingIndex % 2 === 1) {
                    runningHash = createHash('sha256').update(siblingHash + runningHash).digest('hex');
                } else {
                    runningHash = createHash('sha256').update(runningHash + siblingHash).digest('hex');
                }
                workingIndex = Math.floor(workingIndex / 2);
            }

            return referencePeakHashes.includes(runningHash);
        } catch {
            return false;
        }
    }
}