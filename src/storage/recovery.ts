import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * StorageRecoveryEngine provides automated salvage utilities to reconstruct index mapping tables
 * out of surviving append-only ledger transaction segments during disaster management.
 */
export class StorageRecoveryEngine {
    /**
     * Scans a target data directory to completely rebuild missing or damaged index companion schemas.
     * @param directory The absolute directory path string containing database segments.
     * @param baseName The baseline target namespace identifier of the ledger files.
     * @returns True if the restoration loop finishes successfully.
     */
    public static recomputeIndexSchema(directory: string, baseName: string): boolean {
        const dataPath = join(directory, `${baseName}.immr`);
        const indexPath = join(directory, `${baseName}.idx`);

        if (!existsSync(dataPath)) {
            return false;
        }

        try {
            const rawDataContent = readFileSync(dataPath, { encoding: 'utf8' });
            const records: Record<string, Record<string, string>> = JSON.parse(rawDataContent || '{"0":{}}');
            
            const constructedIndexMap: Record<number, number> = {};
            let currentLeafTrackingIndex = 0;

            // Iterate linearly across segments and storage points to find pure leaves
            const sortedSegments = Object.keys(records).map(Number).sort((a, b) => a - b);
            for (const segmentId of sortedSegments) {
                const segmentNodes = records[segmentId];
                const sortedNodeIndices = Object.keys(segmentNodes).map(Number).sort((a, b) => a - b);

                for (const nodeIdx of sortedNodeIndices) {
                    // Under post-order rules, an element at height 0 is a leaf node
                    if (this.evaluateNodeHeight(nodeIdx) === 0) {
                        constructedIndexMap[currentLeafTrackingIndex] = nodeIdx;
                        currentLeafTrackingIndex++;
                    }
                }
            }

            writeFileSync(indexPath, JSON.stringify(constructedIndexMap, null, 2), { encoding: 'utf8' });
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Internal mathematical evaluator checking structural post-order mountain range heights.
     */
    private static evaluateNodeHeight(storageIndex: number): number {
        let indexValue = storageIndex;
        let heightValue = 0;

        while (indexValue > 0) {
            const parentAllocationLimit = (1 << (heightValue + 1)) - 1;
            if (indexValue < parentAllocationLimit) {
                break;
            }
            indexValue -= parentAllocationLimit;
            heightValue++;
        }
        return heightValue;
    }
}