/**
 * Represents a verifiable proof that a specific piece of data 
 * is included inside the append-only ledger.
 */
export interface InclusionProof {
    /** The chronological tracking index assigned to the target leaf. */
    readonly leafIndex: number;
    /** The original unhashed string payload backing the leaf reference. */
    readonly leafValue: string;
    /** The list of sibling hashes required to climb up to a peak. */
    readonly siblings: string[];
    /** The current peak hashes of the mountain range topology. */
    readonly peakHashes: string[];
}

/**
 * Represents a verifiable proof that a historical state of the ledger
 * is a complete structural ancestor of the current extended state.
 */
export interface ConsistencyProof {
    /** The total record volume defining the historical reference point. */
    readonly oldSize: number;
    /** The current total record volume of the extended ledger. */
    readonly newSize: number;
    /** The minimal set of cryptographic hashes needed to re-verify the old root. */
    readonly proofHashes: string[];
}