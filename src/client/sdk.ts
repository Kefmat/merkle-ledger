import { InclusionProof, ConsistencyProof } from '../types/index.js';

/**
 * LedgerSDK Client provides an encapsulated toolkit for interacting 
 * out-of-band with the remote Merkle Mountain Range ledger service cluster.
 */
export class LedgerSDK {
    private readonly remoteServiceUrl: string;

    /**
     * Initializes the client SDK connection proxy parameters.
     * @param serviceEndpoint Base uniform resource locator path string of the target server.
     */
    constructor(serviceEndpoint: string = 'http://127.0.0.1:8080') {
        this.remoteServiceUrl = serviceEndpoint;
    }

    /**
     * Dispatches a non-blocking mutation call to log a structured value entry.
     * @param dataValue The raw string sequence block data log.
     */
    public async appendRecord(dataValue: string): Promise<{ leafIndex: number; masterRoot: string }> {
        const response = await fetch(`${this.remoteServiceUrl}/append`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: dataValue })
        });

        if (!response.ok) {
            throw new Error(`SDK execution fault: Server responded with code ${response.status}`);
        }

        return response.json() as Promise<{ leafIndex: number; masterRoot: string }>;
    }

    /**
     * Pulls an inclusion validation capsule from the ledger engine.
     * @param leafIndex Sequential identifier location.
     * @param value Real data string matching the node commitment.
     */
    public async fetchInclusionProof(leafIndex: number, value: string): Promise<{ proof: InclusionProof; masterRoot: string }> {
        const targetUrl = `${this.remoteServiceUrl}/proof?leafIndex=${leafIndex}&value=${encodeURIComponent(value)}`;
        const response = await fetch(targetUrl, { method: 'GET' });

        if (!response.ok) {
            throw new Error(`SDK fetching fault: Server rejected the transaction lookup query bounds.`);
        }

        return response.json() as Promise<{ proof: InclusionProof; masterRoot: string }>;
    }

    /**
     * Requests verification system parameters confirming data health consistency.
     */
    public async checkSystemIntegrity(): Promise<boolean> {
        const response = await fetch(`${this.remoteServiceUrl}/audit`, { method: 'GET' });
        if (!response.ok) return false;
        
        const payload = await response.json() as { integral: boolean };
        return payload.integral;
    }
}