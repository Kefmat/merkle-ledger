import { createServer, IncomingMessage, ServerResponse } from 'http';
import { MemoryStorage } from './storage/memoryStorage.js';
import { MerkleMountainRange } from './mmr/mmr.js';
import { MerkleProofEngine } from './proofs/engine.js';

/**
 * Inbound transaction payload schema contract for append operations.
 */
interface AppendRequestPayload {
    value: string;
}

/**
 * Inbound proof verification payload schema contract for processing stateless assertions.
 */
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

/**
 * Orchestrates a native non-blocking HTTP networking cluster to process operational 
 * transaction records and retrieve deterministic proof frames.
 */
export class LedgerServer {
    private readonly server;
    private readonly ledger: MerkleMountainRange;

    /**
     * Initializes the microservice abstraction using bounded cryptographic engines.
     * @param storage The index-addressable storage map backing tracking metrics.
     */
    constructor(storage: MemoryStorage) {
        this.ledger = new MerkleMountainRange(storage);
        this.server = createServer((req: IncomingMessage, res: ServerResponse) => this.handleNetworkRequest(req, res));
    }

    /**
     * Binds the server loop to a designated operational networking interface.
     * @param port The decimal TCP port identifier to allocate.
     * @param callback Execution handler fired upon successful interface assignment.
     */
    public listen(port: number, callback: () => void): void {
        this.server.listen(port, '127.0.0.1', callback);
    }

    /**
     * Closes the underlying networking interface cleanly during graceful teardowns.
     */
    public close(): void {
        this.server.close();
    }

    /**
     * Runtime validation type guard ensuring an unvalidated inbound object adheres strictly 
     * to the AppendRequestPayload structure contract definitions.
     * @param obj The candidate object parsed from the network buffer.
     */
    private isValidAppendPayload(obj: unknown): obj is AppendRequestPayload {
        return (
            typeof obj === 'object' &&
            obj !== null &&
            'value' in obj &&
            typeof (obj as AppendRequestPayload).value === 'string' &&
            (obj as AppendRequestPayload).value.trim().length > 0
        );
    }

    /**
     * Runtime validation type guard ensuring an unvalidated inbound object adheres strictly
     * to the VerifyRequestPayload structure contract definitions.
     * @param obj The candidate object parsed from the network buffer.
     */
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

    /**
     * Routes incoming telemetry buffers dynamically based on request path attributes.
     * Wrapped completely within an error-trapping boundary to catch unexpected exceptions.
     * @param req The active inbound connection context wrapper.
     * @param res The outbound network response serialization boundary.
     */
    private handleNetworkRequest(req: IncomingMessage, res: ServerResponse): void {
        try {
            const urlInstance = new URL(req.url ?? '', `http://${req.headers.host ?? 'localhost'}`);
            const path = urlInstance.pathname;

            // Route: Append Entry Log
            if (path === '/append' && req.method === 'POST') {
                let bufferAccumulator = '';
                req.on('data', (chunk: Buffer) => {
                    bufferAccumulator += chunk.toString();
                });

                req.on('end', () => {
                    try {
                        const payload: unknown = JSON.parse(bufferAccumulator);
                        if (!this.isValidAppendPayload(payload)) {
                            this.writeJsonResponse(res, 400, { error: 'Payload validation failed. Must contain a non-empty string "value" property.' });
                            return;
                        }

                        const allocatedLeafIndex = this.ledger.appendLeaf(payload.value);
                        const systemMasterRoot = this.ledger.getMasterRoot();

                        this.writeJsonResponse(res, 201, {
                            leafIndex: allocatedLeafIndex,
                            masterRoot: systemMasterRoot
                        });
                    } catch {
                        this.writeJsonResponse(res, 400, { error: 'Malformed serialization framing metadata. Request body is not valid JSON.' });
                    }
                });
                return;
            }

            // Route: Compile Inclusion Proof
            if (path === '/proof' && req.method === 'GET') {
                const indexParameter = urlInstance.searchParams.get('leafIndex');
                const dataParameter = urlInstance.searchParams.get('value');

                if (indexParameter === null || dataParameter === null || dataParameter.trim().length === 0) {
                    this.writeJsonResponse(res, 400, { error: 'Query bounds must define absolute "leafIndex" and explicit "value" fields.' });
                    return;
                }

                const evaluatedIndex = parseInt(indexParameter, 10);
                if (isNaN(evaluatedIndex) || evaluatedIndex < 0) {
                    this.writeJsonResponse(res, 400, { error: 'Query bound "leafIndex" must be a non-negative integers configuration parameter.' });
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

            // Route: Compile Consistency Proof
            if (path === '/consistency' && req.method === 'GET') {
                const oldSizeParameter = urlInstance.searchParams.get('oldSize');
                if (!oldSizeParameter) {
                    this.writeJsonResponse(res, 400, { error: 'Query parameter must specify a valid historical oldSize boundary.' });
                    return;
                }

                const parsedOldSize = parseInt(oldSizeParameter, 10);
                if (isNaN(parsedOldSize) || parsedOldSize <= 0) {
                    this.writeJsonResponse(res, 400, { error: 'Query bound "oldSize" must be an integer baseline configuration greater than zero.' });
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

            // Route: Verify Structural Proofs (Inclusion, Consistency, or Batch Inclusion)
            if (path === '/verify' && req.method === 'POST') {
                let bufferAccumulator = '';
                req.on('data', (chunk: Buffer) => {
                    bufferAccumulator += chunk.toString();
                });

                req.on('end', () => {
                    try {
                        const payload: unknown = JSON.parse(bufferAccumulator);
                        if (!this.isValidVerifyPayload(payload)) {
                            this.writeJsonResponse(res, 400, { error: 'Payload validation failed. Structural keys are corrupted or mismatched for type.' });
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

                        this.writeJsonResponse(res, 400, { error: 'Invalid or unallocated verification type context.' });
                    } catch {
                        this.writeJsonResponse(res, 400, { error: 'Malformed verification serialization framing metadata. Request body is not valid JSON.' });
                    }
                });
                return;
            }

            // Catch-all fallthrough fallback boundary
            this.writeJsonResponse(res, 404, { error: 'Requested network orchestration endpoint is unallocated.' });
        } catch (globalInternalError) {
            // Trap low-level execution errors to return a 500 response instead of crashing the process
            const msg = globalInternalError instanceof Error ? globalInternalError.message : 'Fatal unhandled engine panic.';
            this.writeJsonResponse(res, 500, { error: 'Internal Server Error', details: msg });
        }
    }

    /**
     * Formats network tracking metrics cleanly as application/json headers.
     * @param res The outbound network response serialization boundary.
     * @param status The transactional HTTP code assignment to inject.
     * @param body The serialized payload instance to submit down the socket.
     */
    private writeJsonResponse(res: ServerResponse, status: number, body: Record<string, unknown>): void {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
    }
}