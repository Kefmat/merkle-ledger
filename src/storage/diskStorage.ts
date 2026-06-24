import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * DiskStorage provides an append-only, non-volatile storage implementation 
 * that preserves the immutable invariants of the ledger across service restarts.
 */
export class DiskStorage {
    private readonly baseDirectory: string;
    private readonly ledgerFileName: string;
    private readonly indexFileName: string;
    private readonly maxBytesPerSegment: number = 5 * 1024 * 1024; // 5MB default chunk cap limit
    
    private currentSegmentIndex: number = 0;
    private memoryCache: Map<number, string> = new Map();
    private leafToStorageMap: Map<number, number> = new Map();

    /**
     * Instantiates the persistent storage engine using a specific target filepath.
     * @param directory The directory path where the binary ledger files will reside.
     * @param filename The base name of the file used to dump raw ledger index nodes.
     */
    constructor(directory: string, filename: string = 'ledger') {
        this.baseDirectory = directory;
        this.ledgerFileName = `${filename}.immr`;
        this.indexFileName = `${filename}.idx`;
        this.ensureDirectoryExists();
        this.initializeStorageSystem();
    }

    /**
     * Asserts target file directories are present in the host system layout.
     */
    private ensureDirectoryExists(): void {
        if (!existsSync(this.baseDirectory)) {
            mkdirSync(this.baseDirectory, { recursive: true });
        }
    }

    /**
     * Asserts structural existence of the system ledger file and hydrates local memory cache registers.
     */
    private initializeStorageSystem(): void {
        const dataPath = join(this.baseDirectory, this.ledgerFileName);
        const indexPath = join(this.baseDirectory, this.indexFileName);

        if (!existsSync(dataPath)) {
            writeFileSync(dataPath, JSON.stringify({ '0': {} }), { encoding: 'utf8' });
        }
        if (!existsSync(indexPath)) {
            writeFileSync(indexPath, JSON.stringify({}), { encoding: 'utf8' });
        }

        try {
            const rawDataContent = readFileSync(dataPath, { encoding: 'utf8' });
            const records: Record<string, Record<string, string>> = JSON.parse(rawDataContent || '{"0":{}}');
            
            const segments = Object.keys(records).map(Number).sort((a, b) => b - a);
            this.currentSegmentIndex = segments[0] ?? 0;

            for (const [segmentId, segmentNodes] of Object.entries(records)) {
                for (const [nodeIdx, hashValue] of Object.entries(segmentNodes)) {
                    this.memoryCache.set(parseInt(nodeIdx, 10), hashValue);
                }
            }

            const rawIndexContent = readFileSync(indexPath, { encoding: 'utf8' });
            const indices: Record<string, number> = JSON.parse(rawIndexContent || '{}');
            
            for (const [leafIdx, storageIdx] of Object.entries(indices)) {
                this.leafToStorageMap.set(parseInt(leafIdx, 10), storageIdx);
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

        this.memoryCache.set(storageIndex, hash);
        this.flushDataToDisk();
    }

    /**
     * Registers a permanent mapping reference associating a sequential leaf index with a tree storage index.
     * @param leafIndex The chronological tracking index of the target leaf.
     * @param storageIndex The absolute storage array position of the target leaf.
     */
    public writeLeafIndexMapping(leafIndex: number, storageIndex: number): void {
        this.leafToStorageMap.set(leafIndex, storageIndex);
        
        const indexPath = join(this.baseDirectory, this.indexFileName);
        const flatIndexObject: Record<number, number> = {};
        for (const [key, value] of this.leafToStorageMap.entries()) {
            flatIndexObject[key] = value;
        }

        writeFileSync(indexPath, JSON.stringify(flatIndexObject, null, 2), { encoding: 'utf8' });
    }

    /**
     * Commits memory states to the correct active transaction logging block on disk.
     */
    private flushDataToDisk(): void {
        const dataPath = join(this.baseDirectory, this.ledgerFileName);
        
        let existingRecords: Record<string, Record<string, string>> = { '0': {} };
        if (existsSync(dataPath)) {
            try {
                existingRecords = JSON.parse(readFileSync(dataPath, { encoding: 'utf8' }));
            } catch {
                // Ignore fallback blocks
            }
        }

        if (!existingRecords[this.currentSegmentIndex]) {
            existingRecords[this.currentSegmentIndex] = {};
        }

        for (const [storageIdx, hashValue] of this.memoryCache.entries()) {
            let placed = false;
            for (const segmentId of Object.keys(existingRecords)) {
                if (existingRecords[segmentId][storageIdx] !== undefined) {
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                existingRecords[this.currentSegmentIndex][storageIdx] = hashValue;
            }
        }

        const serializedData = JSON.stringify(existingRecords, null, 2);
        
        if (serializedData.length > this.maxBytesPerSegment) {
            this.currentSegmentIndex++;
            existingRecords[this.currentSegmentIndex] = {};
            writeFileSync(dataPath, JSON.stringify(existingRecords, null, 2), { encoding: 'utf8' });
        } else {
            writeFileSync(dataPath, serializedData, { encoding: 'utf8' });
        }
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
     * Returns the active map collection correlating sequential leaves directly to tree positions.
     */
    public getHydratedIndexMap(): Map<number, number> {
        return this.leafToStorageMap;
    }

    /**
     * Purges disk file logs and wipes internal memory tables completely during environment resets.
     */
    public clearDatabase(): void {
        this.memoryCache.clear();
        this.leafToStorageMap.clear();
        this.currentSegmentIndex = 0;
        
        const dataPath = join(this.baseDirectory, this.ledgerFileName);
        const indexPath = join(this.baseDirectory, this.indexFileName);
        
        writeFileSync(dataPath, JSON.stringify({ '0': {} }), { encoding: 'utf8' });
        writeFileSync(indexPath, JSON.stringify({}), { encoding: 'utf8' });
    }
}