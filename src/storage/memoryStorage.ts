/**
 * MemoryStorage serves as an index-addressable data repository simulating an append-only physical disk layer.
 * It manages the operational lifecycle of cryptographic hash allocations during tree modification sequences.
 */
export class MemoryStorage {
    /** The underlying memory map mapping absolute sequential integer indices to hexadecimal hashes. */
    private readonly nodeStore: Map<number, string> = new Map();

    /**
     * Persists a cryptographic hash digest at an explicit tracking coordinate inside the memory layout.
     * @param index The absolute sequence offset position allocated inside the tree map.
     * @param hash The 64-character SHA-256 hexadecimal hash string to write.
     * @throws Error if an attempt is made to overwrite or alter a historically committed coordinate.
     */
    public writeNode(index: number, hash: string): void {
        if (this.nodeStore.has(index)) {
            throw new Error(`Persistence invariant violation: Index ${index} has already been committed and is immutable.`);
        }
        this.nodeStore.set(index, hash);
    }

    /**
     * Resolves a historical node hash string using its absolute positioning identifier.
     * @param index The absolute sequence offset position to inspect.
     * @returns The associated hexadecimal cryptographic hash digest, or undefined if the coordinate is unallocated.
     */
    public readNode(index: number): string | undefined {
        return this.nodeStore.get(index);
    }

    /**
     * Determines the total capacity size boundary of the current persistence map layout.
     * @returns The total number of unique cryptographic nodes currently written to the store.
     */
    public size(): number {
        return this.nodeStore.size;
    }
}