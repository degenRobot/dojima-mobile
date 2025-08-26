# SimpleCLOB - Demo CLOB Contracts

A simplified Central Limit Order Book (CLOB) implementation for demo purposes on RISE Chain.

## Overview

SimpleCLOB provides basic order book functionality with:
- Fixed trading pairs (USDC-WETH, USDC-WBTC, WBTC-WETH)
- Built-in ERC20 transfers (no virtual vault complexity)
- Fixed fees: 0.1% maker, 0.2% taker
- Demo tokens with one-time mint functionality

## Contracts

### SimpleCLOB.sol
Main order book contract with core functions:
- `placeOrder()` - Place limit orders
- `matchOrders()` - Execute market orders
- `cancelOrder()` - Cancel existing orders
- `getOrderBook()` - View order book state

### MintableERC20.sol
Demo ERC20 token with:
- One-time mint of 1000 tokens per address
- Support for variable decimals
- Standard ERC20 functionality

## Trading Pairs

| Pair ID | Base  | Quote | Description |
|---------|-------|-------|-------------|
| 0       | WETH  | USDC  | ETH/USD pair |
| 1       | WBTC  | USDC  | BTC/USD pair |
| 2       | WETH  | WBTC  | ETH/BTC pair |

## Testing

```bash
# Run all tests
forge test

# Run with gas report
forge test --gas-report

# Run specific test
forge test --match-test testName
```

## Deployment

```bash
# Deploy to local network
forge script script/DeploySimpleCLOB.s.sol --rpc-url localhost --broadcast

# Deploy to RISE testnet
forge script script/DeploySimpleCLOB.s.sol --rpc-url $RISE_RPC_URL --broadcast
```

## Gas Costs

| Operation      | Gas Cost |
|---------------|----------|
| Place Order   | ~240k    |
| Cancel Order  | ~60k     |
| Market Order  | ~185k    |

## Development

Built with:
- Solidity 0.8.23
- Foundry
- OpenZeppelin Contracts