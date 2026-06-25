import { MerkleMountainRange } from '../mmr/mmr.js';

/**
 * ClusterReplicationAgent orchestrates state matching operations, allowing follower nodes
 * to catch up with remote clusters while validating incoming segments against known root hashes.
 */
export class ClusterReplicationAgent {
    private readonly localLedgerInstance: MerkleMountainRange;

    /**
     * Constructs a synchronization agent linked to local storage frames.
     * @param ledger Target verification engine framework.
     */
    constructor(ledger: MerkleMountainRange) {
        this.localLedgerInstance = ledger;
    }

    /**
     * Queries a remote leader URL to retrieve and apply missing blocks.
     * @param upstreamEndpoint URI target of the cluster leader.
     * @param expectedTargetMasterRoot System hash commitment required to validate the sync chain.
     */
    public async synchronizeFromUpstreamNode(upstreamEndpoint: string, expectedTargetMasterRoot: string): Promise<boolean> {
        try {
            const startingLocalLeafCount = this.localLedgerInstance.getLeafCount();
            const targetQueryUrl = `${upstreamEndpoint}/sync?startingFromIndex=${startingLocalLeafCount}`;
            
            const networkResponse = await fetch(targetQueryUrl);
            if (!networkResponse.ok) {
                return false;
            }

            const consensusPayload = await networkResponse.json() as { missingEntries: string[] };
            if (!consensusPayload.missingEntries || consensusPayload.missingEntries.length === 0) {
                return this.localLedgerInstance.getMasterRoot() === expectedTargetMasterRoot;
            }

            // Apply incoming entries to catch up locally
            for (const record of consensusPayload.missingEntries) {
                this.localLedgerInstance.appendLeaf(record);
            }

            // Reject updates if the resulting master root does not match consensus
            const updatedLocalRoot = this.localLedgerInstance.getMasterRoot();
            return updatedLocalRoot === expectedTargetMasterRoot;
        } catch {
            return false;
        }
    }
}