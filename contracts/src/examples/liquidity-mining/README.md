# Liquidity Mining Example

This example demonstrates how to implement a liquidity mining system for market makers on top of the CLOB order book.

## Overview

The liquidity mining system rewards makers who provide liquidity near the mid price with token emissions. Key features:

- **Spread-based rewards**: Tighter spreads earn more rewards
- **Constant emission rate**: Simple and predictable rewards
- **Auto-enrollment**: Limit orders automatically participate
- **Real-time tracking**: Rewards accrue in real-time

## Architecture

### Core Components

1. **LiquidityMiningBook.sol**: Order book that extends `OrderBook` with farming integration
2. **SimpleFarming.sol**: Farming contract that tracks positions and distributes rewards
3. **LiquidityMiningHook.sol**: Optional hook for tracking maker stats
4. **ILiquidityMining.sol**: Interface defining the farming system

### Key Design Decisions

- **Weight Calculation**: Orders closer to mid price get higher weight (up to 100% at 0.05% spread)
- **No Rebalancing**: When mid price moves, existing orders keep their weight
- **Order Book Integration**: Farming is transparent to traders - just place orders normally

## Usage

```solidity
// Deploy farming contract
SimpleFarming farming = new SimpleFarming(
    rewardToken,
    address(orderBook),
    1e18 // 1 token per second
);

// Deploy order book with farming
LiquidityMiningBook book = new LiquidityMiningBook(
    baseToken,
    quoteToken,
    hooks,
    address(farming)
);

// Users place orders normally - they're auto-enrolled
book.placeOrder(true, 1000e18, 10e18, OrderType.LIMIT);

// Claim rewards anytime
book.claimFarmingRewards();
```

## Reward Mechanics

### Weight Formula

```
spread = abs(orderPrice - midPrice) / midPrice * 10000 (basis points)

if spread <= 0.05% (5 bps):
    weight = amount * 100%
else if spread <= 2% (200 bps):
    weight = amount * (100% - 90% * (spread - 5) / 195)
else:
    weight = 0
```

### Example Weights

- Order at mid ± 0.05%: 100% weight
- Order at mid ± 0.5%: ~77% weight  
- Order at mid ± 1%: ~54% weight
- Order at mid ± 2%: ~10% weight
- Order at mid ± 2%+: 0% weight

## Gas Considerations

- Place order with farming: ~430k gas (vs ~250k without)
- Claim rewards: ~100k gas
- Mid price update: ~30k gas

## Future Improvements

- Dynamic emission rates based on volume
- veToken mechanics for boosted rewards
- Cross-margin position support
- Referral system integration