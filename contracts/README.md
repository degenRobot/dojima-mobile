# CLOB System - Advanced Order Book Implementation

An extensible Central Limit Order Book (CLOB) implementation for EVM chains, featuring cross-pair volume aggregation, dynamic fee tiers, referral mechanics, and Uniswap V4-inspired hooks for customization.

## Quick Start

```bash
# Clone the repository
git clone <repo-url>
cd contracts

# Install Foundry dependencies
forge install

# Run tests
forge test

# Deploy complete system
forge script script/DeployEnhancedCLOB.s.sol --rpc-url $RPC_URL --broadcast
```

## Overview

This CLOB provides a modular, gas-efficient order book implementation optimized for high-throughput chains like RISE. The system supports multiple trading pairs (spot and perpetuals) with unified volume tracking and fee benefits across all pairs.

### Key Features

- **Gas-Efficient Matching**: Red-Black tree with O(log n) operations
- **Multi-Product Support**: Spot and perpetual futures in one system
- **Cross-Pair Volume**: Trade on any pair to unlock fee discounts on all pairs
- **Dynamic Fee Tiers**: Volume-based fees from 0.25% down to 0.05%
- **Referral System**: Built-in referral tracking with rewards
- **Extensible Hooks**: 7 lifecycle points for custom logic
- **Centralized Fee Distribution**: Configurable distribution to treasury, staking, burn, and referrers
- **CREATE2 Deployment**: Hook permission system using address-encoded bits

## Architecture

### Core Components

```
CLOBRegistry
    ├── Tracks all trading pairs
    ├── Aggregates cross-pair volume
    ├── Manages referral relationships
    └── Daily volume buckets for efficiency

CLOBFactory
    ├── Deploys new trading pairs
    ├── Supports spot and perpetual pairs
    ├── Auto-registers with registry
    └── Configures global hooks

GlobalFeeHook (CREATE2 deployed)
    ├── Volume-based fee calculation
    ├── 5-tier fee structure
    ├── Referral bonuses
    └── Market maker rebates

FeeDistributor
    ├── Collects fees from all pairs
    ├── Configurable distribution splits
    ├── Referral reward tracking
    └── Claimable rewards

OrderBook (Abstract)
    ├── Core matching engine
    ├── Price-time priority
    ├── Hook integration points
    └── Comprehensive events

Trading Pairs
    ├── EnhancedSpotBook (ERC20 pairs)
    ├── PerpBook (Perpetual futures)
    └── Custom implementations
```

### System Flow

```
User Trade → OrderBook → GlobalFeeHook (fee calculation)
                ↓
           Volume Recorded in Registry
                ↓
           Fees Collected → FeeDistributor
                              ├── Treasury (40%)
                              ├── Staking (30%)
                              ├── Burn (10%)
                              └── Referrers (20%)
```

## Deployment

### Complete System Deployment

```bash
# Set environment variables
export PRIVATE_KEY=<your-private-key>
export RPC_URL=<your-rpc-url>
export TREASURY_ADDRESS=<treasury-address>

# Deploy everything
forge script script/DeployGlobalCLOB.s.sol \
    --rpc-url $RPC_URL \
    --broadcast \
    --verify
```

### CREATE2 Hook Deployment

The GlobalFeeHook requires deployment at a specific address with permission bits encoded. Use the provided tools:

```bash
# Find suitable salt for hook permissions
forge script script/FindHookSalt.s.sol

# Deploy with CREATE2
forge script script/DeployWithCREATE2Hook.s.sol \
    --rpc-url $RPC_URL \
    --broadcast
```

### Adding New Trading Pairs

After the system is deployed, add new pairs using the factory:

```bash
# Add a new spot pair
forge script script/AddSpotPair.s.sol \
    --sig "run(address,address,address)" \
    $FACTORY_ADDRESS $BASE_TOKEN $QUOTE_TOKEN \
    --rpc-url $RPC_URL \
    --broadcast

# Add a new perpetual pair
forge script script/AddPerpPair.s.sol \
    --sig "run(address,address,address)" \
    $FACTORY_ADDRESS $BASE_TOKEN $COLLATERAL_TOKEN \
    --rpc-url $RPC_URL \
    --broadcast
```

## Fee System

### Volume-Based Tiers

| Tier | 30-Day Volume | Maker Fee | Taker Fee |
|------|---------------|-----------|-----------|
| 0    | $0            | 0.15%     | 0.25%     |
| 1    | $100k         | 0.10%     | 0.20%     |
| 2    | $1M           | 0.05%     | 0.15%     |
| 3    | $10M          | 0.02%     | 0.10%     |
| 4    | $100M         | 0.00%     | 0.05%     |

### Fee Distribution (Default Configuration)

- **50%** → Treasury
- **30%** → Referrer Rewards
- **20%** → Staking Pool
- **0%** → Token Burn

### Referral Benefits

- **Referrer**: Receives portion of fees from referee's trades
- **Referee**: Gets 0.05% fee discount on all trades

## Hook System

Inspired by Uniswap V4, hooks enable permissionless innovation at 7 lifecycle points:

1. **`beforePlaceOrder`** - Validate or modify order parameters
2. **`afterPlaceOrder`** - React to order placement
3. **`onOrderAddedToBook`** - Called when limit order enters book
4. **`beforeMatch`** - Modify match parameters or fees
5. **`afterMatch`** - React to trades (e.g., record volume)
6. **`beforeCancelOrder`** - Approve/reject cancellation
7. **`afterCancelOrder`** - Clean up after cancellation

### Hook Permissions

Hooks must be deployed at addresses with specific permission bits using CREATE2:

```solidity
// Permission flags
uint160 constant BEFORE_MATCH_FLAG = 1 << 10;
uint160 constant AFTER_MATCH_FLAG = 1 << 9;

// Hook address must have these bits set
require(uint160(hookAddress) & AFTER_MATCH_FLAG != 0);
```

## Usage Examples

### Deploy and Trade

```solidity
// User signs up with referral
registry.registerReferral(referrerAddress);

// Trade on any pair
SpotBook ethUsdc = SpotBook(factory.getPair(WETH, USDC));
ethUsdc.deposit(USDC, 10000e6);
ethUsdc.placeOrder(
    true,              // isBuy
    3000e18,          // price: $3000
    1e18,             // amount: 1 ETH
    OrderType.LIMIT
);

// Volume accumulates across all pairs
uint256 totalVolume = registry.getTotalVolume30d(user);
```

### Claim Referral Rewards

```solidity
// Check pending rewards
uint256 pending = feeDistributor.getPendingRewards(user, USDC);

// Claim rewards
feeDistributor.claimReferralRewards(USDC);
```

### Forward and Distribute Fees

```solidity
// Trading pairs forward fees to distributor
// Note: EnhancedSpotBook may handle this automatically
ethUsdc.forwardFeesToDistributor(true, true);

// Anyone can trigger distribution
feeDistributor.distributeAccumulatedFees(USDC);
```

### Important Implementation Notes

1. **Timestamp Ordering**: Orders placed in the same block have equal timestamps. The taker/maker determination uses `buyOrder.timestamp >= sellOrder.timestamp`, so the order placed first is the maker.

2. **Fee Model**: Both parties pay fees on what they receive:
   - Buyer pays fee on BASE tokens received
   - Seller pays fee on QUOTE tokens received

3. **Decimal Handling**: Price is in WAD format (18 decimals) regardless of token decimals

## Gas Benchmarks

Current gas usage for core operations:

**Spot Trading (SpotBook):**
- Place Limit Order: ~192k gas
- Cancel Order: ~16k gas
- Single Match: ~380k gas (includes fee calculation)
- Market Order: ~320k gas

**With Global Fee Hook & Volume Tracking:**
- Additional overhead: ~50-100k gas per match
- Cross-pair volume aggregation: No additional cost
- Fee distribution: Batched for efficiency

## Security Considerations

**This is unaudited code. Do not use in production without proper security review.**

Key security features:
- Access control on critical functions
- Reentrancy protection via checks-effects-interactions
- Fee caps to prevent abuse (max 10%)
- Permission-based hook activation
- Referral signup limits (once per user)

## Testing

```bash
# Run all tests
forge test

# Run with gas reporting
forge test --gas-report

# Test specific component
forge test --match-contract EnhancedCLOBSystem

# Run CREATE2 tests
forge test --match-test CREATE2
```

## Project Structure

```
src/
├── OrderBook.sol              # Abstract base order book
├── CLOBRegistry.sol           # Cross-pair registry
├── CLOBFactory.sol            # Pair deployment factory
├── FeeDistributor.sol         # Fee collection & distribution
├── EnhancedSpotBook.sol       # Spot trading implementation
├── types/                     # Type definitions
├── interfaces/                # Contract interfaces
├── libraries/                 # Utility libraries
├── hooks/                     # Hook implementations
│   ├── GlobalFeeHook.sol      # Volume-based fees
│   ├── PerpHook.sol           # Perpetual futures
│   └── LiquidityMiningHook.sol # Maker rewards
└── examples/                  # Example implementations
    ├── spot/                  # Spot trading
    ├── perps/                 # Perpetual futures
    └── liquidity-mining/      # Farming rewards
```

## Scripts

Production-ready deployment and management scripts:

```
script/
├── DeployEnhancedCLOB.s.sol   # Complete system deployment
├── DeployWithCREATE2Hook.s.sol # CREATE2 hook deployment
├── FindHookSalt.s.sol         # Find CREATE2 salts
├── AddSpotPair.s.sol          # Add new spot pair
├── AddPerpPair.s.sol          # Add new perp pair
└── ExampleCREATE2Deployment.s.sol # CREATE2 examples
```

## Future Enhancements

1. **Advanced Order Types**: Stop-loss, iceberg orders
2. **Automated Distribution**: Keeper network for fee distribution
3. **Multi-Chain**: Deploy on multiple chains with unified volume
4. **Options Trading**: Hook for options on top of spot
5. **Lending Integration**: Use idle balances for lending

## Resources

- [Architecture Overview](./Architecture.md) - Technical deep dive
- [Foundry Book](https://book.getfoundry.sh/) - Foundry documentation
- [RISE Chain Docs](https://docs.risechain.com) - Deployment target

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Submit a pull request

## License

MIT