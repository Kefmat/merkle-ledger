/**
 * Represents a discrete cryptographic node envelope within the mountain range sequence.
 */
export interface MerkleNode {
    /** The absolute sequential flat-array index position of this node in the ledger hierarchy. */
    index: number;
    /** The unique 64-character fixed-size SHA-256 hexadecimal cryptographic hash digest. */
    hash: string;
}

/**
 * Encapsulates the complete cryptographic validation markers needed to prove that a leaf entry
 * exists inside the ledger at an explicit tracking position.
 */
export interface InclusionProof {
    /** The absolute entry offset position where the target data record leaf resides. */
    leafIndex: number;
    /** The raw, unhashed string payload representing the historical entry context. */
    leafValue: string;
    /** The ordered collection of sibling node hashes matching the climbing verification path. */
    siblings: string[];
    /** The root hashes of the isolated perfect binary trees currently forming the mountain peaks. */
    peakHashes: string[];
}

/**
 * Encapsulates the cryptographic proof tokens required to demonstrate that an updated ledger state
 * is a pure, append-only continuation of a previously verified historical snapshot size.
 */
export interface ConsistencyProof {
    /** The total count of data records present in the historical baseline snapshot. */
    oldSize: number;
    /** The total count of data records present in the new extended ledger state. */
    newSize: number;
    /** The minimal set of historical peak hashes necessary to reconstruct the baseline root commitment. */
    proofHashes: string[];
}