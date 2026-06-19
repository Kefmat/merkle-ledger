import { createServer, IncomingMessage, ServerResponse } from 'http';
import { MemoryStorage } from './storage/memoryStorage.js';
import { MerkleMountainRange } from './mmr/mmr.js';
import { MerkleProofEngine } from './proofs/engine.js';

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
     * Routes incoming telemetry buffers dynamically based on request path attributes.
     * @param req The active inbound connection context wrapper.
     * @param res The outbound network response serialization boundary.
     */
    private handleNetworkRequest(req: IncomingMessage, res: ServerResponse): void {
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
                    const payload = JSON.parse(bufferAccumulator) as { value?: string };
                    if (!payload.value) {
                        this.writeJsonResponse(res, 400, { error: 'Payload must contain a valid non-empty string reference.' });
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
            return;
        }

        // Route: Compile Inclusion Proof
        if (path === '/proof' && req.method === 'GET') {
            const indexParameter = urlInstance.searchParams.get('leafIndex');
            const dataParameter = urlInstance.searchParams.get('value');

            if (!indexParameter || !dataParameter) {
                this.writeJsonResponse(res, 400, { error: 'Query bounds must define absolute leafIndex and explicit value fields.' });
                return;
            }

            try {
                const evaluatedIndex = parseInt(indexParameter, 10);
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

            try {
                const parsedOldSize = parseInt(oldSizeParameter, 10);
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

        // Route: Verify Structural Proofs (Inclusion or Consistency)
        if (path === '/verify' && req.method === 'POST') {
            let bufferAccumulator = '';
            req.on('data', (chunk: Buffer) => {
                bufferAccumulator += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const payload = JSON.parse(bufferAccumulator) as {
                        type?: 'inclusion' | 'consistency';
                        rootHash?: string;
                        leafValue?: string;
                        leafIndex?: number;
                        siblings?: string[];
                        peakHashes?: string[];
                        oldRootHash?: string;
                        newRootHash?: string;
                        proofHashes?: string[];
                        currentPeakHashes?: string[];
                    };

                    if (payload.type === 'inclusion') {
                        if (!payload.rootHash || !payload.leafValue || payload.leafIndex === undefined || !payload.siblings) {
                            this.writeJsonResponse(res, 400, { error: 'Missing properties for inclusion verification.' });
                            return;
                        }
                        const isValid = MerkleProofEngine.verifyInclusion(
                            payload.rootHash,
                            payload.leafValue,
                            payload.leafIndex,
                            payload.siblings,
                            payload.peakHashes ?? []
                        );
                        this.writeJsonResponse(res, 200, { valid: isValid });
                        return;
                    }

                    if (payload.type === 'consistency') {
                        if (!payload.oldRootHash || !payload.newRootHash || !payload.proofHashes || !payload.currentPeakHashes) {
                            this.writeJsonResponse(res, 400, { error: 'Missing properties for consistency verification.' });
                            return;
                        }
                        const isValid = MerkleProofEngine.verifyConsistency(
                            payload.oldRootHash,
                            payload.newRootHash,
                            payload.proofHashes,
                            payload.currentPeakHashes
                        );
                        this.writeJsonResponse(res, 200, { valid: isValid });
                        return;
                    }

                    this.writeJsonResponse(res, 400, { error: 'Invalid or unallocated verification type context.' });
                } catch {
                    this.writeJsonResponse(res, 400, { error: 'Malformed verification serialization framing metadata.' });
                }
            });
            return;
        }

        // Catch-all fallthrough fallback boundary
        this.writeJsonResponse(res, 404, { error: 'Requested network orchestration endpoint is unallocated.' });
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