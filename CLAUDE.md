# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

We are building a CLOB using the rise-vibe-kit, a full-stack template for building dApps on RISE blockchain with real-time features, automatic contract syncing, and embedded wallet support.

The primary goal of this template is to provide a fast and efficient way for builders to build dApps on RISE blockchain with real-time features, automatic contract syncing, and embedded wallet support along with easy to use templates / contracts / tools available. 

## Commands

### Development
```bash
npm run dev                  # Start frontend dev server
npm run chain               # Run local Anvil fork
npm run deploy-and-sync     # Deploy contracts & sync to frontend
npm run test                # Run contract tests
npm run build               # Build frontend
npm run lint                # Run frontend linter
npm run type-check          # TypeScript validation
```

### Deployment
```bash
npm run deploy-and-sync                    # Default deployment
npm run deploy-and-sync -- -a              # Deploy all contracts
npm run deploy-and-sync -- -s DeployScript # Deploy specific script
npm run deploy-and-sync -- -v              # Deploy with verification
npm run deploy-and-sync -- -n localhost    # Deploy to local network
```

### Contract Testing
```bash
cd contracts && forge test                 # Run all tests
cd contracts && forge test --gas-report    # Test with gas reporting
cd contracts && forge test --match-test testName  # Run specific test
```

## Architecture

### Monorepo Structure
- `/contracts` - Foundry-based Solidity contracts
- `/frontend` - Next.js 15 app with TypeScript
- `/ponder` - Optional blockchain event indexer
- `/scripts` - Deployment and synchronization automation

### Key Technologies
- **Smart Contracts**: Solidity, Foundry, OpenZeppelin
- **Frontend**: Next.js 15, TypeScript 5, Tailwind CSS v4, Wagmi v2, Viem v2, Ethers v6
- **Real-time**: Custom WebSocket manager for RISE's `rise_subscribe` method
- **Embedded Wallet**: Shreds package for browser-based wallets with `eth_sendRawTransactionSync`

### Contract Sync Flow
1. Deployment scripts in `/contracts/script/` deploy to RISE testnet
2. `sync-contracts.js` extracts addresses/ABIs from broadcast files
3. TypeScript types auto-generated in `/frontend/src/contracts/`
4. Frontend hooks automatically use latest contract data

### WebSocket Event System
- `RiseWebSocketManager` maintains persistent WebSocket connection
- Subscribes to all deployed contracts automatically
- Decodes events using contract-specific ABIs
- Provides real-time updates to React components via context

### Embedded Wallet Integration
- `RiseSyncClient` handles synchronous transactions for embedded wallets
- Auto-detects token deployments and increases gas limit (5M vs 300k)
- Nonce management prevents transaction conflicts
- Falls back to standard flow for external wallets

## RISE-Specific Features

### Synchronous Transactions
RISE supports `eth_sendRawTransactionSync` via the shreds package, providing instant transaction receipts without waiting for block confirmation.

### Real-time Events
WebSocket subscriptions via `rise_subscribe` deliver blockchain events in real-time through "shreds" (sub-blocks).


## Development Workflow

1. Write contracts in `/contracts/src/`
2. Create deployment script in `/contracts/script/`
3. Run `npm run deploy-and-sync`
4. Frontend automatically updates with new contract data

## Important Files

- `/frontend/src/lib/websocket/RiseWebSocketManager.ts` - WebSocket event handling
- `/frontend/src/lib/rise-sync-client.ts` - Embedded wallet transactions
- `/frontend/src/contracts/contracts.ts` - Auto-generated contract data
- `/frontend/src/hooks/useContractFactory.ts` - Contract interaction hook factory

## Error Handling Patterns

- Always check for embedded wallet vs external wallet in transaction flows
- Handle BigInt serialization with `serializeBigInt` utility
- Detect token deployments by function selector for appropriate gas limits
- Subscribe to all contracts on WebSocket connection/reconnection

# CLOB 

We are using : https://github.com/degenRobot/open-clob
cloned in open-clob as the core building blocks for our contracts 

We are using ponder for indexing : https://ponder.sh/
(specfically ponder-rise package : https://www.npmjs.com/package/ponder-rise)

# Long Term Objective 

See PRD.md for notes on long term objectives for our CLOB 
(Note this repo is just a prototype so we don't need to meet all requirements)



# Code style

- For frontend code - maintain type safety & ensure npm run build doesn't throw errors so we can deploy to production simply 
- For contracts write unit tests & use foundry test 

# External Resources

Foundry Book: Official Foundry documentation : https://book.getfoundry.sh/