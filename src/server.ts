import { createServer, IncomingMessage, ServerResponse } from 'http';
import { DiskStorage } from './storage/diskStorage.js';
import { MerkleMountainRange } from './mmr/mmr.js';
import { MerkleProofEngine } from './proofs/engine.js';

interface AppendRequestPayload {
    value: string;
}

interface VerifyRequestPayload {
    type: 'inclusion' | 'consistency' | 'batch-inclusion';
    rootHash?: string;
    leafValue?: string;
    leafIndex?: number;
    siblings?: string[];
    peakHashes?: string[];
    oldRootHash?: string;
    newRootHash?: string;
    proofHashes?: string[];
    currentPeakHashes?: string[];
    leaves?: Array<{ index: number; value: string }>;
}

export class LedgerServer {
    private readonly server;
    private readonly ledger: MerkleMountainRange;
    private executionQueueChain: Promise<unknown> = Promise.resolve();

    constructor(storage: DiskStorage) {
        this.ledger = new MerkleMountainRange(storage);
        this.server = createServer((req: IncomingMessage, res: ServerResponse) => this.handleNetworkRequest(req, res));
    }

    public listen(port: number, callback: () => void): void {
        this.server.listen(port, '127.0.0.1', callback);
    }

    public close(): void {
        this.server.close();
    }

    private enqueueTransactionTask<T>(taskHandler: () => Promise<T>): Promise<T> {
        const sequentialPromise = this.executionQueueChain.then(() => taskHandler());
        this.executionQueueChain = sequentialPromise.catch(() => {});
        return sequentialPromise;
    }

    private isValidAppendPayload(obj: unknown): obj is AppendRequestPayload {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            'value' in obj &&
            typeof (obj as AppendRequestPayload).value === 'string' &&
            (obj as AppendRequestPayload).value.trim().length > 0
        );
    }

    private isValidVerifyPayload(obj: unknown): obj is VerifyRequestPayload {
        if (typeof obj !== 'object' || obj === null) {
            return false;
        }
        
        const candidate = obj as VerifyRequestPayload;
        if (candidate.type !== 'inclusion' && candidate.type !== 'consistency' && candidate.type !== 'batch-inclusion') {
            return false;
        }

        if (candidate.type === 'inclusion') {
            return (
                typeof candidate.rootHash === 'string' &&
                typeof candidate.leafValue === 'string' &&
                typeof candidate.leafIndex === 'number' &&
                Array.isArray(candidate.siblings) &&
                candidate.siblings.every(s => typeof s === 'string')
            );
        }

        if (candidate.type === 'consistency') {
            return (
                typeof candidate.oldRootHash === 'string' &&
                typeof candidate.newRootHash === 'string' &&
                Array.isArray(candidate.proofHashes) &&
                candidate.proofHashes.every(p => typeof p === 'string') &&
                Array.isArray(candidate.currentPeakHashes) &&
                candidate.currentPeakHashes.every(cp => typeof cp === 'string')
            );
        }

        if (candidate.type === 'batch-inclusion') {
            return (
                typeof candidate.rootHash === 'string' &&
                Array.isArray(candidate.leaves) &&
                candidate.leaves.every(l => typeof l === 'object' && l !== null && typeof l.index === 'number' && typeof l.value === 'string') &&
                Array.isArray(candidate.proofHashes) &&
                candidate.proofHashes.every(p => typeof p === 'string') &&
                Array.isArray(candidate.peakHashes) &&
                candidate.peakHashes.every(ph => typeof ph === 'string')
            );
        }

        return false;
    }

    private handleNetworkRequest(req: IncomingMessage, res: ServerResponse): void {
        try {
            const urlInstance = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
            const path = urlInstance.pathname;

            if (path === '/append' && req.method === 'POST') {
                let bufferAccumulator = '';
                req.on('data', (chunk: Buffer) => {
                    bufferAccumulator += chunk.toString();
                });

                req.on('end', () => {
                    this.enqueueTransactionTask(async () => {
                        try {
                            const payload: unknown = JSON.parse(bufferAccumulator);
                            if (!this.isValidAppendPayload(payload)) {
                                this.writeJsonResponse(res, 400, { error: 'Payload validation failed.' });
                                return;
                            }

                            const allocatedLeafIndex = this.ledger.appendLeaf(payload.value);
                            const systemMasterRoot = this.ledger.getMasterRoot();

                            this.writeJsonResponse(res, 201, {
                                leafIndex: allocatedLeafIndex,
                                masterRoot: systemMasterRoot
                            });
                        } catch {
                            this.writeJsonResponse(res, 400, { error: 'Malformed serialization framing metadata.' });
                        }
                    });
                });
                return;
            }

            if (path === '/proof' && req.method === 'GET') {
                const indexParameter = urlInstance.searchParams.get('leafIndex');
                const dataParameter = urlInstance.searchParams.get('value');

                if (indexParameter === null || dataParameter === null || dataParameter.trim().length === 0) {
                    this.writeJsonResponse(res, 400, { error: 'Query bounds must define parameters fields.' });
                    return;
                }

                const evaluatedIndex = parseInt(indexParameter, 10);
                if (isNaN(evaluatedIndex) || evaluatedIndex < 0) {
                    this.writeJsonResponse(res, 400, { error: 'Query bound must be a non-negative integer parameter.' });
                    return;
                }

                try {
                    const completeProofPacket = this.ledger.generateInclusionProof(evaluatedIndex, dataParameter);
                    const currentMasterRoot = this.ledger.getMasterRoot();

                    this.writeJsonResponse(res, 200, {
                        proof: completeProofPacket,
                        masterRoot: currentMasterRoot
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown execution error.';
                    this.writeJsonResponse(res, 404, { error: message });
                }
                return;
            }

            if (path === '/consistency' && req.method === 'GET') {
                const oldSizeParameter = urlInstance.searchParams.get('oldSize');
                if (!oldSizeParameter) {
                    this.writeJsonResponse(res, 400, { error: 'Query parameter must specify historical size.' });
                    return;
                }

                const parsedOldSize = parseInt(oldSizeParameter, 10);
                if (isNaN(parsedOldSize) || parsedOldSize <= 0) {
                    this.writeJsonResponse(res, 400, { error: 'Query bound oldSize must be greater than zero.' });
                    return;
                }

                try {
                    const consistencyProofPacket = this.ledger.generateConsistencyProof(parsedOldSize);
                    const currentMasterRoot = this.ledger.getMasterRoot();
                    const activePeakHashes = this.ledger.getPeakHashes();

                    this.writeJsonResponse(res, 200, {
                        proof: consistencyProofPacket,
                        currentMasterRoot,
                        currentPeakHashes: activePeakHashes
                    });
                } catch (error) {
                    const message = error instanceof Error ? error.message : 'Unknown consistency evaluation error.';
                    this.writeJsonResponse(res, 404, { error: message });
                }
                return;
            }

            if (path === '/verify' && req.method === 'POST') {
                let bufferAccumulator = '';
                req.on('data', (chunk: Buffer) => {
                    bufferAccumulator += chunk.toString();
                });

                req.on('end', () => {
                    try {
                        const payload: unknown = JSON.parse(bufferAccumulator);
                        if (!this.isValidVerifyPayload(payload)) {
                            this.writeJsonResponse(res, 400, { error: 'Payload validation failed.' });
                            return;
                        }

                        if (payload.type === 'inclusion') {
                            const isValid = MerkleProofEngine.verifyInclusion(
                                payload.rootHash!,
                                payload.leafValue!,
                                payload.leafIndex!,
                                payload.siblings!,
                                payload.peakHashes ?? []
                            );
                            this.writeJsonResponse(res, 200, { valid: isValid });
                            return;
                        }

                        if (payload.type === 'consistency') {
                            const isValid = MerkleProofEngine.verifyConsistency(
                                payload.oldRootHash!,
                                payload.newRootHash!,
                                payload.proofHashes!,
                                payload.currentPeakHashes!
                            );
                            this.writeJsonResponse(res, 200, { valid: isValid });
                            return;
                        }

                        if (payload.type === 'batch-inclusion') {
                            const isValid = MerkleProofEngine.verifyMultiInclusion(
                                payload.rootHash!,
                                payload.leaves!,
                                payload.proofHashes!,
                                payload.peakHashes!
                            );
                            this.writeJsonResponse(res, 200, { valid: isValid });
                            return;
                        }
                    } catch {
                        this.writeJsonResponse(res, 400, { error: 'Malformed verification serialization body.' });
                    }
                });
                return;
            }

            if (path === '/stats' && req.method === 'GET') {
                this.writeJsonResponse(res, 200, {
                    leafCount: this.ledger.getLeafCount(),
                    masterRoot: this.ledger.getMasterRoot(),
                    activePeaksCount: this.ledger.getPeakHashes().length
                });
                return;
            }

            if (path === '/audit' && req.method === 'GET') {
                const structuralHealthMatches = this.ledger.auditLedgerIntegrity();
                this.writeJsonResponse(res, 200, { integral: structuralHealthMatches });
                return;
            }

            this.writeJsonResponse(res, 404, { error: 'Requested endpoint is unallocated.' });
        } catch (globalInternalError) {
            const msg = globalInternalError instanceof Error ? globalInternalError.message : 'Fatal engine panic.';
            this.writeJsonResponse(res, 500, { error: 'Internal Server Error', details: msg });
        }
    }

    private writeJsonResponse(res: ServerResponse, status: number, body: Record<string, unknown>): void {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    }
}