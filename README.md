# Merkle Ledger

A high-performance, append-only, tamper-evident cryptographic transaction log engine built on post-order flat-indexed Merkle Mountain Ranges (MMR). This repository provides a formal framework for data integrity, stateless auditability, and efficient historical verification.

## Overview

Merkle Mountain Ranges allow new transactional records to be appended sequentially without rebalancing or rewriting prior tree structures. The ledger is represented mathematically as a sequence of perfect binary subtrees, each covering a power-of-two range of leaves.

### Architectural Invariants

* **Amortized $O(1)$ Append Performance:** New leaf nodes are committed directly to a flat-array layout, triggering cascading parent merges only when preceding peaks reach matching tree heights.
* **$O(\log n)$ Inclusion Proofs:** Clients can verify that a specific log entry exists inside the ledger at a declared index position using an ordered collection of sibling hashes.
* **$O(\log n)$ Consistency Proofs:** Auditors can verify that a newer state configuration is a pure, append-only continuation of a historical snapshot size, completely preventing retroactive history rewrites.
* **Strict Immutability Guarantee:** The underlying persistence engine enforces a write-once constraint per storage index to defend against memory tampering attacks.

## Repository Structure

```text
merkle-ledger/
├── src/
│   ├── index.ts          # Microservice initialization and port listener setup
│   ├── server.ts         # Native HTTP request router and endpoint orchestration
│   ├── mmr/
│   │   ├── mmr.ts        # Core tree mechanics, peak aggregation, and proof calculation
│   │   └── math.js       # Flat post-order array index-traversal utilities
│   ├── proofs/
│   │   └── engine.ts     # Stateless verification logic for inclusion and consistency claims
│   ├── storage/
│   │   └── memoryStorage.ts # Index-addressable storage boundary with immutable write-guards
│   ├── types/
│   │   └── index.ts      # Shared operational interfaces and serialization contracts
│   └── test/
│       └── ledger.test.ts # Automated regression and security test suites
├── dist/                 # Compiled JavaScript distribution artifacts
├── package.json          # Node.js project manifest and dependency graph
└── tsconfig.json         # TypeScript compiler configurations