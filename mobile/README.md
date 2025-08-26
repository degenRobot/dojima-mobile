# Dojima Mobile CLOB

A React Native mobile application for decentralized trading on the RISE testnet, featuring gasless transactions through Porto Protocol and real-time updates via WebSocket.

## Features

- **Gasless Trading**: All transactions are executed through Porto relay, eliminating gas fees for users
- **Real-time Updates**: WebSocket connection for live order book updates and trade notifications
- **Full Trading Interface**: 
  - Limit and market orders
  - Order book visualization
  - Recent trades feed
  - Multiple trading pairs
- **Portfolio Management**:
  - Token balances
  - Open positions tracking
  - Order history with filters
- **Secure Session Management**: Session keys stored securely using expo-secure-store

## Architecture

### Core Technologies
- **React Native + Expo**: Cross-platform mobile development
- **Porto Protocol**: Gasless transaction execution via meta-transactions
- **WebSocket**: Real-time blockchain event subscriptions
- **Viem/Ethers**: Ethereum interaction libraries

### Key Components

#### Porto Integration (`src/providers/PortoProvider.tsx`)
- Manages session wallet creation and delegation setup
- Handles gasless transaction execution
- Automatic delegation deployment on first use

#### WebSocket Manager (`src/providers/WebSocketProvider.tsx`)
- Maintains persistent WebSocket connection to RISE testnet
- Auto-reconnection with exponential backoff
- Event subscription management for CLOB contracts

#### Trading Components
- `OrderForm`: Place buy/sell orders with gasless execution
- `OrderBook`: Real-time bid/ask visualization
- `RecentTrades`: Live trade feed
- `PairSelector`: Switch between trading pairs

#### Portfolio Components
- `BalanceList`: Token balances and values
- `PositionList`: Open trading positions with P&L
- `OrderHistory`: Historical orders with status filters

## Installation

```bash
# Install dependencies
npm install

# iOS specific
cd ios && pod install && cd ..

# Start development
npm start
```

## Running the App

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run on physical device
# Scan QR code from Expo Go app
```

## Configuration

### Network Settings
Edit `src/config/contracts.ts`:
```typescript
export const NETWORK_CONFIG = {
  chainId: 11155931,              // RISE Testnet
  rpcUrl: 'https://testnet.riselabs.xyz',
  wsUrl: 'wss://testnet.riselabs.xyz/ws',
  portoRelayUrl: 'https://rise-testnet-porto.fly.dev',
}
```

### Contract Addresses
All CLOB contract addresses are configured in `src/config/contracts.ts`

## Porto Gasless Flow

1. **Session Key Generation**: On first launch, generates a session key and stores securely
2. **Delegation Setup**: Automatically sets up Porto delegation for the session key
3. **Transaction Execution**: All contract calls go through Porto relay
4. **Status Tracking**: Real-time transaction status via Porto RPC

## WebSocket Events

The app automatically subscribes to:
- Order placement events
- Trade execution events
- Balance updates
- Market data changes

## Security

- Session keys stored in secure device storage
- No private keys exposed in code
- Biometric authentication support (optional)
- Session timeout for inactive users

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

## Project Structure

```
mobile/
├── App.tsx                 # Main app with navigation
├── src/
│   ├── screens/           # Main app screens
│   ├── components/        # Reusable components
│   │   ├── trading/      # Trading UI components
│   │   └── portfolio/    # Portfolio components
│   ├── providers/        # Context providers
│   ├── hooks/           # Custom React hooks
│   ├── lib/            # Core libraries
│   │   ├── porto/      # Porto client implementation
│   │   └── websocket/  # WebSocket management
│   └── config/         # App configuration
```

## Troubleshooting

### Porto Connection Issues
- Ensure Porto relay URL is accessible
- Check delegation status in Settings screen
- Reset session from Settings if needed

### WebSocket Disconnections
- App automatically reconnects with exponential backoff
- Check network status indicator in trading screen
- Manual reconnection available in Settings

### Transaction Failures
- Verify delegation is deployed (Settings > Account)
- Check session key validity
- Ensure sufficient balance for trades

## Development Notes

- Use `npm run dev` for hot reloading
- Redux DevTools available in development mode
- Network requests logged to console in dev mode

## Future Enhancements

- [ ] Chart integration for price visualization
- [ ] Push notifications for order fills
- [ ] Advanced order types (stop-loss, take-profit)
- [ ] Multi-wallet support
- [ ] Fiat on-ramp integration
- [ ] Trading history export
- [ ] Dark/light theme toggle

## License

MIT