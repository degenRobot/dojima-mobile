# CLOB Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Contract Architecture](#contract-architecture)
3. [Core Components](#core-components)
4. [Data Structures](#data-structures)
5. [Hook System](#hook-system)
6. [Storage Layout](#storage-layout)
7. [Gas Optimization Strategies](#gas-optimization-strategies)
8. [Security Architecture](#security-architecture)
9. [Testing Architecture](#testing-architecture)

## System Overview

The CLOB (Central Limit Order Book) system is a modular, gas-efficient implementation of an on-chain order book with an extensible hook system inspired by Uniswap V4.

### Design Principles
- **Modularity**: Clean separation between matching engine and settlement
- **Extensibility**: Hook system allows permissionless innovation
- **Gas Efficiency**: Optimized storage patterns and minimal external calls
- **Security First**: Comprehensive access controls and invariant testing

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         External Users                           │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Global System Components                       │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐  │
│  │CLOBRegistry  │  │  CLOBFactory    │  │ FeeDistributor   │  │
│  │(Volume/Refs) │  │ (Pair Deploy)   │  │ (Fee Collection) │  │
│  └──────────────┘  └─────────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Hook Contracts                              │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │ GlobalFeeHook   │  │ LiquidityMining  │  │   PerpHook   │  │
│  │ (CREATE2)       │  │      Hook        │  │              │  │
│  └─────────────────┘  └──────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    OrderBook (Abstract)                          │
│  - Core matching engine with RB-tree                            │
│  - Hook integration points (7 lifecycle hooks)                  │
│  - Order state management                                       │
│  - Event emission                                               │
│                                                                  │
│  Uses: StoragePacking, TransientStorage, CLOBTypes libraries    │
└─────────────────────────────────────────────────────────────────┘
                                 │
     ┌──────────┬────────────────┼───────────────┬────────────────┐
     ▼          ▼                ▼               ▼                ▼
┌─────────────────┐ ┌─────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
│EnhancedSpotBook │ │PerpBook │ │LiquidityMining│ │DynamicFeeBook│ │  SpotBook   │
│(Fee Forwarding) │ │         │ │    Book       │ │              │ │ (Basic)     │
└─────────────────┘ └─────────┘ └──────────────┘ └─────────────┘ └──────────────┘
     │           │              │                │
     │           ▼              ▼                ▼
     │    ┌──────────────────────────────────────────────┐
     │    │        Supporting Contracts                   │
     │    │ ┌──────────┐ ┌──────────────┐ ┌────────────┐│
     │    │ │   Perp   │ │SimpleFarming │ │SimpleFee   ││
     │    │ │          │ │              │ │  Example   ││
     │    │ └──────────┘ └──────────────┘ └────────────┘│
     │    │ ┌─────────────┐ ┌──────────────────┐        │
     │    │ │PerpLiquidator│ │CollateralManager│        │
     │    │ └─────────────┘ └──────────────────┘        │
     │    └──────────────────────────────────────────────┘
     │                           │
     └───────────────────────────┘
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│              External Dependencies & Tokens                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │Base Token   │  │Quote Token  │  │   Oracle (Mock)     │    │
│  │(e.g. ETH)   │  │(e.g. USDC)  │  │                     │    │
│  └─────────────┘  └─────────────┘  └─────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### OrderBook (Abstract Contract)

The abstract base contract that implements the core matching engine.

**Key Responsibilities:**
- Order placement and validation
- Price-time priority matching using Red-Black trees
- Order cancellation logic
- Hook integration at 7 lifecycle points
- Event emission for all actions

**Key Functions:**
```solidity
- placeOrder(isBuy, price, amount, orderType)
- cancelOrder(orderId)
- matchOrders(maxMatches)
- _matchLimitOrder(orderId, isBuy, price, amount)
- _matchMarketOrder(isBuy, amount)
```

### Example Implementations

The project includes several concrete implementations in `src/examples/`:

#### SpotBook
Concrete implementation for spot trading of ERC20 token pairs.

**Features:**
- Virtual vault system for gas-efficient settlement
- Deposit/withdraw functionality
- Balance tracking with available/locked amounts
- Maker/taker fee system
- Owner-controlled fee parameters

**Key Functions:**
```solidity
- deposit(token, amount)
- withdraw(token, amount)
- withdrawAll()
- setFees(makerFeeBps, takerFeeBps)
- setFeeRecipient(recipient)
```

#### PerpBook
Perpetual futures implementation extending SpotBook.

**Features:**
- Position tracking with netting
- Integration with Perp contract for P&L
- Liquidation support
- Health factor monitoring

**Key Functions:**
```solidity
- Inherits all SpotBook functions
- Integrates with PerpHook for position management
```

#### LiquidityMiningBook
Liquidity mining implementation extending OrderBook directly.

**Features:**
- Auto-enrollment of limit orders
- Mid price tracking
- Integration with SimpleFarming contract
- Pass-through reward claiming

**Key Functions:**
```solidity
- placeOrder() - Auto-enrolls in farming
- cancelOrder() - Removes from farming
- claimFarmingRewards()
- pendingFarmingRewards(user)
- enrollOrderInFarming(orderId)
```

#### DynamicFeeBook
Advanced fee management implementation extending SpotBook.

**Features:**
- Integration with FeeHook for dynamic pricing
- Volume-based tier management
- Market maker rebate support
- Fee override capabilities

**Key Functions:**
```solidity
- Inherits all SpotBook functions
- Integrates with FeeHook for dynamic fee calculation
```

#### StorageOptimizationDemo
Educational implementation showcasing gas optimization techniques.

**Features:**
- Demonstrates storage packing patterns
- Benchmarks different optimization approaches
- Shows bit manipulation techniques
- Compares gas costs of various implementations

**Purpose:**
- Teaching resource for developers
- Reference implementation for optimizations
- Benchmark baseline for improvements

### Hook System

Hooks are external contracts that can modify or react to order book operations.

**Hook Points:**
1. `beforePlaceOrder` - Modify order parameters
2. `afterPlaceOrder` - React to placement
3. `onOrderAddedToBook` - Called for limit orders
4. `beforeMatch` - Modify match parameters
5. `afterMatch` - React to matches
6. `beforeCancelOrder` - Approve/reject cancellation
7. `afterCancelOrder` - React to cancellation

**Hook Implementation Pattern:**
```solidity
contract MyHook is BaseCLOBHook {
    function beforeMatch(...) external override returns (bytes4, MatchDelta memory) {
        // Custom logic
        return (this.beforeMatch.selector, delta);
    }
}
```

## Data Structures

### Order Storage

**PackedOrder Structure:**
```solidity
struct PackedOrder {
    uint128 price;      // Price in quote token
    uint128 amount;     // Amount remaining
    uint32 timestamp;   // Order timestamp
    uint8 flags;        // Status, type, side packed
    address trader;     // Trader address
}
```

**Optimized Storage (Phase 1):**
- Slot 1: price (128) + amount (96) + orderId[0:32] (32) = 256 bits
- Slot 2: orderId[32:88] (56) + timestamp (32) + flags (8) + trader (160) = 256 bits

### Balance Management

**PackedBalance Structure:**
```solidity
struct PackedBalance {
    uint128 available;  // Available balance
    uint128 locked;     // Locked in orders
}
```

**Optimized Balance:**
- Single slot: available (96) + locked (96) + netPending (64) = 256 bits

### Price Trees

Uses Solady's Red-Black Tree implementation for O(log n) operations:
- Separate trees for buy and sell sides
- Key encoding: price + metadata
- Value: orderId

## Hook System

### Hook Architecture

**BaseCLOBHook:**
- Abstract base contract for all hooks
- Default implementation reverts with `HookNotImplemented`
- Hooks only override needed functions

**Hook Permission Model (Uniswap V4 Inspired):**
- Hooks must be set at deployment (immutable)
- Permission bits encoded in hook address via CREATE2
- Each hook point can be individually enabled
- Address bits determine allowed functions:
  ```solidity
  BEFORE_MATCH_FLAG = 1 << 10;  // bit 10
  AFTER_MATCH_FLAG = 1 << 9;     // bit 9
  // ... other flags
  ```

## Global System Components

### CLOBRegistry
- **Purpose**: Central registry for all trading pairs and volume tracking
- **Deployed**: `0x2188C521c03DCcFf0C8b55B2A55D29B106F548b1`
- **Key Features**:
  - Cross-pair volume aggregation
  - 30-day rolling volume with daily buckets
  - Referral relationship tracking
  - One-time referral signup per user
  - Automated cleanup of old volume data

### CLOBFactoryModular
- **Purpose**: Modular factory system for deploying trading pairs
- **Deployed**: `0x005ba978527eE83f722Cc1822D3F87d8dBcb6B55`
- **Key Features**:
  - Modular architecture to overcome contract size limits
  - Delegates to specialized factories (SpotFactory, PerpFactory)
  - Auto-registration with CLOBRegistry
  - Hook authorization management
  - CREATE2 support for deterministic addresses

### SpotFactory
- **Purpose**: Specialized factory for spot trading pairs
- **Deployed**: `0x2661816e0e8a210084817a87ae5c9A2D7638004C`
- **Key Features**:
  - Deploys EnhancedSpotBook instances
  - Integrates with GlobalFeeHook for fee calculations
  - Auto-registers pairs with CLOBRegistry
  - Configures fee forwarding to FeeDistributor

### FeeDistributor
- **Purpose**: Centralized fee collection and distribution
- **Deployed**: `0xC0A738e222C78d1F3658Cff6C534715DBC17fa5F`
- **Key Features**:
  - Configurable distribution splits (treasury, staking, burn, referrers)
  - Claimable referral rewards
  - Token-specific accumulation
  - Anyone can trigger distribution
  - Access control for configuration

### Implemented Hooks

**GlobalFeeHook (CREATE2 Deployed):**
- **Deployed**: `0x7EBE5AA248F62837aeb5315FeB95A055ed930A24`
- Volume-based fee tiers (5 levels: 0% to 0.25%)
- Cross-pair volume aggregation via CLOBRegistry
- 30-day rolling volume with daily buckets
- Market maker rebate program
- Referral system integration
- Dynamic fee calculation in `beforeMatch`
- Volume recording in `afterMatch`
- Must be deployed at specific address with permission bits

**LiquidityMiningHook:**
- Rewards based on spread tightness
- Time-weighted liquidity provision
- Claim mechanism for rewards
- Integrates via `onOrderAddedToBook` and `afterMatch`

**PerpHook:**
- Perpetual futures on spot order book
- Position tracking and aggregation
- Oracle integration for P&L
- Triggers on `afterMatch`
- Supports liquidation mechanics

### Supporting Contracts

**SimpleFarming:**
- Constant emission rate rewards
- Spread-based weight calculation
- 0.05% spread = 100% weight, 2% spread = 0% weight
- Real-time accrual system
- Multi-order support per user

**Perp:**
- Core perpetual futures logic
- Position management with netting
- Oracle-based mark price
- Health factor calculation
- Liquidation engine

**PerpLiquidator:**
- Automated liquidation of unhealthy positions
- Incentivized liquidator rewards
- Integration with Perp contract
- Batch liquidation support

**CollateralManager:**
- Multi-collateral support for perpetuals
- Collateral ratio tracking
- Cross-margin calculations
- Withdrawal restrictions based on positions

**SimpleFeeExample:**
- Example implementation of custom fee logic
- Demonstrates hook-based fee customization
- Volume tracking patterns

### Library Components

**StoragePacking:**
- Bit manipulation utilities
- Efficient packing/unpacking of storage slots
- Used for order and balance optimization

**TransientStorage:**
- EIP-1153 transient storage helpers
- Temporary data during transaction execution
- Gas optimization for multi-step operations

**CLOBHooks:**
- Hook utility functions
- Permission checking
- Hook registration helpers

### Type Definitions

**CLOBTypes.sol:**
- Core order book data structures
- Order, MatchResult, MatchDelta types
- Event definitions
- Enums for order types and states

**OptimizedTypes.sol:**
- Packed storage structures
- Bit-packed order representation
- Optimized balance storage

## Storage Layout

### Storage Optimization Strategies

1. **Bit Packing**: Multiple values in single storage slot
2. **Transient Storage**: Temporary data during matching
3. **Storage Packing Library**: Efficient field updates
4. **Tree Key Encoding**: Metadata embedded in RB-tree keys

### Critical Storage Mappings

```solidity
// Order storage
mapping(uint256 => PackedOrder) orders;

// User balances (token => user => balance)
mapping(address => mapping(address => PackedBalance)) balances;

// Price trees (marketId => tree)
mapping(uint256 => RedBlackTreeLib.Tree) buyTree;
mapping(uint256 => RedBlackTreeLib.Tree) sellTree;

// User orders tracking
mapping(address => uint256[]) traderOrders;
```

## Gas Optimization Strategies

### Virtual Vault Pattern
- Minimizes ERC20 transfers
- Batch settlement for multiple trades
- Internal balance tracking

### Storage Optimizations
- Packed structs to minimize slots
- Bit manipulation for flag updates
- Assembly for critical paths

### Algorithm Optimizations
- Red-Black tree for O(log n) operations
- Early exit conditions
- Minimal external calls

### Current Gas Costs
**SpotBook (Basic):**
- Place Order: ~192k gas
- Cancel Order: ~16k gas
- Single Match: ~380k gas (with fees)
- Market Order: ~320k gas

**EnhancedSpotBook (With Global System):**
- Additional overhead: ~50-100k gas
- Cross-pair volume tracking: Included
- Fee forwarding: Batched for efficiency

## Security Architecture

### Access Control
- `onlyOwner`: Fee and parameter updates
- `onlyHook`: Hook callback restrictions
- Immutable critical parameters

### Invariants Maintained
1. Balance Accounting: Sum of user balances = contract balance
2. Locked Amounts: Locked balance = sum of active orders
3. No Negative Balances: Enforced by uint types
4. Price Ordering: Best bid < Best ask
5. Order Integrity: Valid status transitions

### Security Patterns
- Checks-Effects-Interactions
- Reentrancy protection via state updates
- Input validation on all external calls
- Overflow protection with Solidity 0.8+

## Testing Architecture

### Test Categories

1. **Unit Tests**
   - Individual function testing
   - Edge case coverage
   - Error condition validation
   - Example: `test/SpotBook.t.sol`, `test/SpotBookFees.t.sol`
   - Fee calculation tests with maker/taker determination

2. **Integration Tests**
   - Multi-contract interactions
   - Hook integration testing
   - End-to-end scenarios
   - Global system tests (Registry, Factory, FeeDistributor)
   - CREATE2 deployment tests
   - Example: `test/GlobalCLOBSystem.t.sol`, `test/HookCREATE2Deployment.t.sol`

3. **Invariant Tests**
   - Property-based testing
   - Handler-based fuzzing
   - 256 runs per invariant
   - Example: `test/CLOBInvariantTest.t.sol`

4. **Gas Benchmarks**
   - Operation cost tracking
   - Optimization validation
   - Regression prevention
   - Example: `test/GasBenchmark.t.sol`, `test/ExtendedGasBenchmark.t.sol`

5. **Security Tests**
   - Reentrancy protection validation
   - Permission system testing
   - Access control verification
   - Example: `test/security/ReentrancyTest.t.sol`, `test/security/HookPermissionTest.t.sol`

6. **Example Tests**
   - Tests for each example implementation
   - Usage pattern demonstrations
   - Integration scenarios
   - Example: `test/examples/dynamic-fees/`, `test/examples/liquidity-mining/`

### Test Infrastructure

**Handler Pattern for Invariants:**
```solidity
contract CLOBHandler {
    // Stateful fuzzing actions
    function deposit(uint256 seed, uint256 amount) external;
    function placeOrder(...) external;
    function cancelOrder(...) external;
    
    // State tracking for invariant checks
    mapping(address => uint256) userDeposited;
    uint256[] activeOrders;
}
```

### Coverage Metrics
- Comprehensive test suite with multiple categories
- Core functionality: 100% coverage
- Hook integration: All 7 lifecycle points tested
- Security: Dedicated test suite for permissions and reentrancy
- Gas optimization: Benchmarked and tracked
- Example implementations: Each example has dedicated tests

## Development Guidelines

### Adding New Features
1. Extend abstract OrderBook for new order types
2. Implement hooks for additional functionality
3. Maintain storage optimization patterns
4. Add comprehensive tests
5. For global features:
   - Register with CLOBRegistry
   - Integrate with FeeDistributor
   - Use CLOBFactory for deployment
   - Consider CREATE2 for hook addresses

### Gas Optimization Checklist
- [ ] Use packed storage where possible
- [ ] Minimize external calls
- [ ] Implement early exit conditions
- [ ] Measure with gas benchmarks
- [ ] Compare against baseline

### Security Checklist
- [ ] Input validation on all external functions
- [ ] Access control for privileged operations
- [ ] Invariant tests for new features
- [ ] Consider MEV implications
- [ ] Document assumptions

## Recent Deployment (RISE Testnet)

### Deployed Contracts (2025-07-19)
- **CLOBRegistry**: `0x2188C521c03DCcFf0C8b55B2A55D29B106F548b1`
- **GlobalFeeHook**: `0x7EBE5AA248F62837aeb5315FeB95A055ed930A24`
- **FeeDistributor**: `0xC0A738e222C78d1F3658Cff6C534715DBC17fa5F`
- **CLOBFactoryModular**: `0x005ba978527eE83f722Cc1822D3F87d8dBcb6B55`
- **SpotFactory**: `0x2661816e0e8a210084817a87ae5c9A2D7638004C`
- **EnhancedSpotBook (WETH-USDC)**: `0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222`
- **WETH (Mock)**: `0x0da0E0657016533CB318570d519c62670A377748`
- **USDC (Mock)**: `0x71a1A92DEF5A4258788212c0Febb936041b5F6c1`

### Deployment Architecture
The deployment uses a modular factory pattern to overcome contract size limitations:
1. **CLOBFactoryModular** acts as the main entry point
2. **SpotFactory** handles EnhancedSpotBook deployments
3. **GlobalFeeHook** provides cross-pair fee calculations
4. All contracts register with **CLOBRegistry** for volume tracking
5. Fees are forwarded to **FeeDistributor** for revenue sharing

## Important Implementation Details

### Fee Calculation Model
The system uses a unique fee model where **both parties pay fees on what they receive**:
- **Buyer**: Pays fee on BASE tokens received
- **Seller**: Pays fee on QUOTE tokens received

This differs from traditional models where only the taker pays fees.

### Taker/Maker Determination
- Uses timestamp comparison: `buyOrder.timestamp >= sellOrder.timestamp`
- Orders in the same block have equal timestamps
- The order placed first is always the maker
- Tests must use `vm.warp()` to ensure proper timestamp ordering

### Price Format
- All prices are in WAD format (18 decimals)
- Represents quote amount per base unit
- Example: For USDC (6 decimals) / ETH (18 decimals):
  - Price of 2000 USDC per ETH = 2000e6 in WAD format

### CREATE2 Deployment for Hooks
Hooks must be deployed at addresses with specific permission bits:
1. Calculate required permission bits
2. Find salt that produces address with those bits
3. Deploy using CREATE2 at the calculated address
4. Verify permissions are encoded correctly

## Future Architecture Considerations

### Scaling Solutions
- L2-specific optimizations
- Batch order placement
- Off-chain matching with on-chain settlement

### Advanced Features
- Cross-margin support
- Portfolio margining
- Advanced order types (stop-loss, trailing stop)

### Governance Integration
- Parameter adjustment via governance
- Hook whitelisting mechanism
- Emergency pause functionality