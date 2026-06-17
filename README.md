# Merkle Ledger

A high-performance, append-only, tamper-evident transaction log engine built on Merkle Mountain Ranges (MMR). This repository provides a cryptographic framework for strong data integrity, auditability, and efficient historical verification.

## Overview

Merkle Mountain Ranges allow new records to be appended without rebalancing prior tree structures. The ledger is represented as a sequence of perfect binary subtrees, each covering a power-of-two range of leaves.

Key benefits:

* **Amortized O(1) append performance** for new leaves
* **O(log n) inclusion proofs** for efficient verification
* **Tamper-evident auditability** through deterministic hash chaining

## Repository Structure

* `src/index.ts` - Example orchestration and ledger usage entrypoint.
* `src/mmr/mmr.ts` - Core MMR engine for node generation, peak tracking, and proof construction.
* `src/proofs/engine.ts` - Proof generation and verification logic.
* `src/storage/memoryStorage.ts` - In-memory append-only storage implementation.
* `src/types/index.ts` - Shared data types, interfaces, and payload definitions.

## Getting Started

### Prerequisites

* Node.js 20 or later
* npm

### Install

```bash
npm install
```

### Build

```bash
npx tsc
```

### Run

```bash
node dist/index.js
```

> Note: This repository currently does not define a `build` or `test` npm script. Use `npx tsc` to compile the project.

## Development Notes

* The project is written in TypeScript and compiles to `dist/`.
* The current package scripts are minimal and can be extended with `build`, `test`, or `start` entries.
