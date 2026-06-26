import { readFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

/**
 * StorageScavenger evaluates raw immutable file segments linearly to verify
 * that back-to-back record structures match their cryptographically chained signatures.
 */
export class StorageScavenger {
    /**
     * Sequentially audits data segments on disk to locate record corruptions.
     * @param logSegmentPath Absolute string path to the targeted immutable segment.
     * @returns True if every structural element checks out successfully.
     */
    public static runIntegrityAudit(logSegmentPath: string): boolean {
        if (!existsSync(logSegmentPath)) {
            return false;
        }

        try {
            const rawContent = readFileSync(logSegmentPath, { encoding: 'utf8' });
            const elements: Array<{ payload: string; expectedHash: string }> = JSON.parse(rawContent || '[]');

            for (const item of elements) {
                const verifiedHash = createHash('sha256').update(item.payload).digest('hex');
                if (verifiedHash !== item.expectedHash) {
                    console.error(`[SCAVENGER ALERT] Bit rot or corruption detected inside entry: ${item.payload}`);
                    return false;
                }
            }

            return true;
        } catch {
            return false;
        }
    }
}