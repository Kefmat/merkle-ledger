/**
 * MathUtilities provides static pure functions to calculate topological properties
 * of a post-order traversal flat-array Merkle Mountain Range representation.
 */
export class MathUtilities {

    /**
     * Determines the height of a node at a given flat-array index position.
     * @param index The 1-based or 0-based flat serialization index.
     * @returns The height coordinate where 0 represents a base leaf node.
     */
    public static getNodeHeight(index: number): number {
        let numericPointer = index + 1;
        while (numericPointer > 0) {
            const logicalExponent = Math.floor(Math.log2(numericPointer));
            const perfectTreeSize = (1 << (logicalExponent + 1)) - 1;
            
            if (numericPointer === perfectTreeSize) {
                return logicalExponent;
            }
            numericPointer -= (1 << logicalExponent) - 1;
        }
        return 0;
    }

    /**
     * Calculates the flat serialization index of the sibling node.
     * @param index The absolute flat index of the current node.
     * @param height The verified height of the current node inside the tree topology.
     * @returns The absolute flat index of the sibling node coordinate.
     */
    public static getSiblingIndex(index: number, height: number): number {
        const treeSizeForHeight = (1 << (height + 1)) - 1;
        const nextIndexCalculated = index + 1;
        
        if (MathUtilities.getNodeHeight(nextIndexCalculated) === height + 1) {
            return index - treeSizeForHeight;
        }
        return index + treeSizeForHeight;
    }

    /**
     * Identifies the collection of peak indices that constitute the mountain range topology based on total size.
     * @param totalNodes The overall count of committed nodes written to the ledger.
     * @returns An ordered collection of structural peak index positions.
     */
    public static getPeakIndices(totalNodes: number): number[] {
        const peakCollection: number[] = [];
        let indexPointer = 0;

        while (indexPointer < totalNodes) {
            let currentHeight = MathUtilities.getNodeHeight(indexPointer);
            let peekAheadIndex = indexPointer + ((1 << (currentHeight + 1)) - 1);
            
            while (peekAheadIndex <= totalNodes) {
                indexPointer = peekAheadIndex - 1;
                currentHeight = MathUtilities.getNodeHeight(indexPointer);
                peekAheadIndex = indexPointer + 2;
            }
            
            peakCollection.push(indexPointer);
            indexPointer++;
        }

        return peakCollection;
    }
}