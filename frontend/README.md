# Dojima Frontend

A modern trading interface for the Dojima CLOB built with Next.js 15, TypeScript, and Tailwind CSS v4.

## Features

### ✅ Implemented
- **Real-time Trading**: Live order book updates via WebSocket
- **Embedded Wallet Support**: Instant transactions with RISE's synchronous execution
- **Auto-synced Contracts**: Contract addresses and ABIs automatically updated from deployments
- **Professional Trading UI**: Advanced charting, order forms, and market depth visualization
- **Order Management**: Place limit orders, view open orders, cancel orders
- **Trade History**: View past trades and order execution details
- **Market Stats**: 24h volume, price changes, high/low tracking
- **Price Charts**: Real-time candlestick charts with multiple timeframes (1m, 5m, 15m, 1h, 4h, 1d)
- **Portfolio Page**: View balances, positions, and P&L
- **Deposit/Withdraw**: Token deposits and withdrawals with modal interface

### 🚧 In Progress
- **Leaderboard**: Top traders by volume/PnL (UI exists, needs data)
- **Analytics Page**: Protocol-wide statistics and charts
- **Simple Trading Mode**: Swap-style interface for beginners

### ❌ Not Yet Implemented
- **Perpetual Futures**: No perps trading UI
- **Advanced Order Types**: Only limit orders supported (no stop-loss, take-profit)
- **Multi-chain Support**: Only RISE testnet
- **Mobile Optimization**: Desktop-first design

## Getting Started

First, ensure contracts are deployed and synced:

```bash
# From root directory
npm run deploy-and-sync
```

Then run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Available Scripts

```bash
npm run dev          # Start development server with Turbopack
npm run build        # Production build
npm run lint         # Lint code
npm run type-check   # TypeScript validation
```

## Contract Integration

Contract addresses and ABIs are automatically synced from deployments to `src/contracts/contracts.ts`. The system supports:

- **EnhancedSpotBook**: Full-featured spot trading with fee forwarding
- **GlobalFeeHook**: Dynamic volume-based fees
- **CLOBRegistry**: Cross-pair volume tracking
- **FeeDistributor**: Revenue sharing system

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Known Issues

1. **Market Entity**: Currently hardcoded to single market address, needs dynamic market selection
2. **Fee Rates**: Using hardcoded fee rates (0.1% maker, 0.3% taker) instead of reading from contract
3. **Price Oracle**: Token prices hardcoded for portfolio valuation
4. **24h Stats**: Not using rolling window, shows cumulative stats
5. **WebSocket Reconnection**: No automatic reconnection on disconnect

## Architecture

### Data Flow
1. **Contract Events** → **RISE Node** → **Ponder Indexer** → **GraphQL API** → **React Query** → **UI Components**
2. **User Actions** → **Wagmi Hooks** → **Viem** → **Smart Contracts**
3. **Real-time Updates** → **WebSocket** → **React Context** → **UI Updates**

### Key Components
- `/app` - Next.js 15 app directory with page routes
- `/components/trading` - Trading UI components (OrderBook, OrderForm, Chart)
- `/hooks/api` - GraphQL query hooks with React Query
- `/hooks` - Contract interaction hooks using Wagmi
- `/lib` - WebSocket manager, GraphQL client, utilities
- `/contracts` - Auto-generated contract addresses and ABIs

## Deployment

### Environment Variables
```env
NEXT_PUBLIC_INDEXER_URL=http://localhost:42069  # Ponder GraphQL endpoint
NEXT_PUBLIC_WS_URL=wss://testnet.riselabs.xyz   # RISE WebSocket endpoint
```

### Production Deployment
```bash
npm run build
npm run start
```

### Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
