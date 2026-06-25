import { MerkleMountainRange } from './mmr.js';

/**
 * TransactionBatchPipeline aggregates large transaction vectors,
 * executing bulk mutations in a single processing step.
 */
export class TransactionBatchPipeline {
    private readonly targetEngine: MerkleMountainRange;

    /**
     * Binds the transaction pipeline to an active Merkle engine context.
     * @param engine The target MerkleMountainRange instance tracker.
     */
    constructor(engine: MerkleMountainRange) {
        this.targetEngine = engine;
    }

    /**
     * Processes a block collection of text items in sequence.
     * @param transactionBlock Array of raw transactions to insert.
     * @returns List of leaf indexes assigned to the appended items.
     */
    public executePipelineFlush(transactionBlock: string[]): number[] {
        if (!transactionBlock || transactionBlock.length === 0) {
            return [];
        }

        const allocatedIndices: number[] = [];
        
        // Execute updates sequentially within an isolated atomic frame
        for (let i = 0; i < transactionBlock.length; i++) {
            const indexResult = this.targetEngine.appendLeaf(transactionBlock[i]);
            allocatedIndices.push(indexResult);
        }

        return allocatedIndices;
    }
}