# Trading Simulation Scripts

This directory contains scripts for simulating trading activity on the CLOB with multiple worker addresses.

## Prerequisites

1. Deploy the CLOB contracts (SpotBook, WETH, USDC)
2. Set up environment variables in `.env`:
   ```
   PRIVATE_KEY=<your_deployer_private_key>
   RPC_URL=<your_rpc_url>
   ```

## Worker Addresses

The scripts use 5 pre-configured worker addresses with the following private keys:

- **Worker 0 (Market Maker 1)**: `0x65d30c043b1873515d05296843f0bcf03a902ddd5bfa46b86160dcc43faa2093`
- **Worker 1 (Market Maker 2)**: `0x6383e98e179ac5163d0fbdde57d9eb43a2ec00057cea298ba05c9b7cf4f385ff`
- **Worker 2 (Taker 1)**: `0x454868d3792f5fda9c57c823b6f82e98d3b2523a1e3ca5ba39974a1698e4d7db`
- **Worker 3 (Taker 2)**: `0x637c749bcb2bab2c1d0ca36bb76a7085f51950cc15326940fe68fd25d638d612`
- **Worker 4 (Arbitrageur)**: `0x2f785e47e3042e2da6fda9cdc0f41f1466ee01577bc223a4242822dc78507c0f`

## Available Scripts

### 1. SetupWorkers.s.sol
Sets up worker addresses with mock tokens (WETH/USDC).

```bash
forge script script/actions/SetupWorkers.s.sol --rpc-url $RPC_URL --broadcast
```

Features:
- Checks current token balances for all workers
- Mints tokens if balances are below minimum thresholds
- Uses faucet function if deployer cannot mint
- Displays ETH balances for gas fee monitoring

### 2. SimulateTrading.s.sol
Executes a comprehensive trading simulation with different trading strategies.

```bash
forge script script/actions/SimulateTrading.s.sol --rpc-url $RPC_URL --broadcast
```

Features:
- Market makers place limit orders to provide liquidity
- Takers execute market orders to simulate real trades
- Arbitrageur monitors and tightens spreads
- Displays order book state before and after trading

### 3. MonitorOrderBook.s.sol
Displays detailed order book information and market metrics.

```bash
forge script script/actions/MonitorOrderBook.s.sol --rpc-url $RPC_URL
```

Features:
- Market summary with bid/ask counts
- Order book depth visualization
- Spread analysis and market sentiment
- Liquidity metrics and price impact estimates

### 4. ContinuousTrading.s.sol
Runs continuous trading simulation in loops.

```bash
# Run 10 iterations (default)
forge script script/actions/ContinuousTrading.s.sol --rpc-url $RPC_URL --broadcast

# Run custom number of iterations
ITERATIONS=50 forge script script/actions/ContinuousTrading.s.sol --rpc-url $RPC_URL --broadcast
```

Features:
- Configurable number of trading iterations
- Dynamic market making with random spreads
- Random buy/sell decisions by takers
- Arbitrage opportunities detection
- Real-time market state updates

## Typical Workflow

1. **Initial Setup**
   ```bash
   # Setup workers with tokens
   forge script script/actions/SetupWorkers.s.sol --rpc-url $RPC_URL --broadcast
   ```

2. **Run Trading Simulation**
   ```bash
   # One-time comprehensive simulation
   forge script script/actions/SimulateTrading.s.sol --rpc-url $RPC_URL --broadcast
   
   # OR continuous trading
   ITERATIONS=20 forge script script/actions/ContinuousTrading.s.sol --rpc-url $RPC_URL --broadcast
   ```

3. **Monitor Results**
   ```bash
   # Check order book state
   forge script script/actions/MonitorOrderBook.s.sol --rpc-url $RPC_URL
   ```

## Trading Parameters

### Market Making
- Base spread: 50 USDC
- Order sizes: 1 WETH per order
- Multiple orders at different price levels

### Market Taking
- Random buy/sell decisions
- Order sizes: 0.3-0.5 WETH
- Market orders with slippage protection

### Arbitrage
- Monitors spreads continuously
- Places orders when spread > 50 bps
- Uses post-only orders for maker fees

## Customization

You can modify the following parameters in the scripts:

- `BASE_PRICE`: Initial market price (default: 3500 USDC/WETH)
- `PRICE_SPREAD`: Distance between order levels
- `ORDER_SIZE_WETH`: Size of individual orders
- `DEPOSIT_PERCENTAGE`: How much of wallet balance to deposit
- `MIN_SPREAD` / `MAX_SPREAD`: Market maker spread range

## Notes

- All scripts include error handling for failed transactions
- Workers need ETH for gas fees (check with SetupWorkers script)
- Market conditions will evolve based on trading activity
- Use MonitorOrderBook script to analyze market depth and liquidity