import { openSync, readSync, writeSync, closeSync, existsSync, writeFileSync } from 'fs';

/**
 * BinaryPageCache manages the high-speed interaction of index mapping records
 * using a fixed 8-byte uint64 layout directly mapped inside file arrays.
 */
export class BinaryPageCache {
    private readonly cachePath: string;
    private fileDescriptor: number = -1;
    private readonly PAGE_SIZE_BYTES: number = 8; // Each pointer occupies 64 bits

    /**
     * Allocates a target binary file backing store.
     * @param targetPath The destination directory tracking file.
     */
    constructor(targetPath: string) {
        this.cachePath = targetPath;
        this.initializeFile();
    }

    /**
     * Verifies physical file visibility or generates a clean starting marker.
     */
    private initializeFile(): void {
        if (!existsSync(this.cachePath)) {
            writeFileSync(this.cachePath, Buffer.alloc(0));
        }
        this.fileDescriptor = openSync(this.cachePath, 'r+');
    }

    /**
     * Directly updates a specific numeric offset target pointer.
     * @param pageOffset The tracking index parameter.
     * @param targetStorageIndex The real disk allocation layout point.
     */
    public saveMappingPointer(pageOffset: number, targetStorageIndex: number): void {
        const ioBuffer = Buffer.alloc(this.PAGE_SIZE_BYTES);
        ioBuffer.writeBigUInt64BE(BigInt(targetStorageIndex), 0);
        
        const destinationFileOffset = pageOffset * this.PAGE_SIZE_BYTES;
        writeSync(this.fileDescriptor, ioBuffer, 0, this.PAGE_SIZE_BYTES, destinationFileOffset);
    }

    /**
     * Extracts a stored address from raw byte arrays instantly.
     * @param pageOffset The requested tracking slot.
     * @returns The structural tree mapping pointer.
     */
    public fetchMappingPointer(pageOffset: number): number {
        const ioBuffer = Buffer.alloc(this.PAGE_SIZE_BYTES);
        const sourceFileOffset = pageOffset * this.PAGE_SIZE_BYTES;
        
        try {
            const readBytesVolume = readSync(this.fileDescriptor, ioBuffer, 0, this.PAGE_SIZE_BYTES, sourceFileOffset);
            if (readBytesVolume < this.PAGE_SIZE_BYTES) {
                return -1;
            }
            return Number(ioBuffer.readBigUInt64BE(0));
        } catch {
            return -1;
        }
    }

    /**
     * Closes underlying active input/output streams cleanly.
     */
    public terminateCacheStream(): void {
        if (this.fileDescriptor !== -1) {
            closeSync(this.fileDescriptor);
            this.fileDescriptor = -1;
        }
    }
}