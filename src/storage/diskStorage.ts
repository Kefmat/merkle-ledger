import { writeFileSync, readFileSync, existsSync, openSync, closeSync } from 'fs';
import { join } from 'path';

/**
 * DiskStorage provides an append-only, non-volatile storage implementation 
 * that preserves the immutable invariants of the ledger across service restarts.
 */
export class DiskStorage {
    private readonly filePath: string;
    private memoryCache: Map<number, string> = new Map();

    /**
     * Instantiates the persistent storage engine using a specific target filepath.
     * @param directory The directory path where the binary ledger file will reside.
     * @param filename The name of the file used to dump raw ledger index nodes.
     */
    constructor(directory: string, filename: string = 'ledger.immr') {
        this.filePath = join(directory, filename);
        this.initializeStorageFile();
    }

    /**
     * Asserts structural existence of the system ledger file and hydrates local memory cache registers.
     */
    private initializeStorageFile(): void {
        if (!existsSync(this.filePath)) {
            writeFileSync(this.filePath, JSON.stringify({}), { encoding: 'utf8' });
            return;
        }

        try {
            const rawContent = readFileSync(this.filePath, { encoding: 'utf8' });
            const records: Record<string, string> = JSON.parse(rawContent || '{}');
            
            for (const [key, value] of Object.entries(records)) {
                this.memoryCache.set(parseInt(key, 10), value);
            }
        } catch (error) {
            throw new Error(`Storage restoration exception: Ledger database file is corrupted or unreadable. ${error}`);
        }
    }

    /**
     * Persists a cryptographic hash token to a specific flat index location.
     * @param storageIndex The sequential destination position identifier.
     * @param hash The calculated 64-character hexadecimal signature data.
     * @throws Error if an attempt is made to overwrite an existing location index.
     */
    public writeNode(storageIndex: number, hash: string): void {
        if (this.memoryCache.has(storageIndex)) {
            throw new Error(`Persistence invariant violation: Storage index ${storageIndex} is already populated and immutable.`);
        }

        // Update the operational RAM cache register
        this.memoryCache.set(storageIndex, hash);

        // Commit serialized states synchronously to disk to assure execution durability
        const flatObject: Record<number, string> = {};
        for (const [key, value] of this.memoryCache.entries()) {
            flatObject[key] = value;
        }

        writeFileSync(this.filePath, JSON.stringify(flatObject, null, 2), { encoding: 'utf8' });
    }

    /**
     * Reads a cryptographic signature value from an absolute index coordinate.
     * @param storageIndex The target retrieval slot reference.
     * @returns The saved hexadecimal hash signature, or null if unallocated.
     */
    public readNode(storageIndex: number): string | null {
        return this.memoryCache.get(storageIndex) ?? null;
    }

    /**
     * Purges disk file logs and wipes internal memory tables completely during environment resets.
     */
    public clearDatabase(): void {
        this.memoryCache.clear();
        writeFileSync(this.filePath, JSON.stringify({}), { encoding: 'utf8' });
    }
}