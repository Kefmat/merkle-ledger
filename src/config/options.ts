/**
 * LedgerRuntimeConfiguration specifies systemic constraints, performance flags,
 * and data boundary caps used to tune the background Merkle ledger engine.
 */
export interface LedgerRuntimeConfiguration {
    /** Absolute filepath directory target holding cold data blocks. */
    readonly storageDirectory: string;
    /** Base text tag used to uniquely identity the database cluster. */
    readonly storageBaseName: string;
    /** The absolute byte ceiling allowed for an operational block chunk before rotation. */
    readonly maxSegmentByteLimit: number;
    /** Controls network transmission timeouts across client SDK fetch loops. */
    readonly networkTimeoutMilliseconds: number;
    /** Flag determining whether operational telemetry traces report to the console pipe. */
    readonly enableVerboseDiagnostics: boolean;
}

/**
 * Global default configurations tuned for high-throughput transactional environments.
 */
export const DEFAULT_PRODUCTION_CONFIG: LedgerRuntimeConfiguration = {
    storageDirectory: './data/ledger',
    storageBaseName: 'immutable_registry',
    maxSegmentByteLimit: 10 * 1024 * 1024, // 10MB chunk caps
    networkTimeoutMilliseconds: 5000,
    enableVerboseDiagnostics: true
};