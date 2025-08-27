// App constants and configuration

export const APP_CONFIG = {
  appName: 'Dojima CLOB',
  version: '1.0.0',
  supportEmail: 'support@dojima.app',
} as const;

// Storage keys for secure storage
export const STORAGE_KEYS = {
  PRIVATE_KEY: 'privateKey', // Alphanumeric only for SecureStore
  SESSION_KEY: 'sessionKey',
  DELEGATION_STATUS: 'delegationStatus',
  HAS_DELEGATED: 'hasDelegated', // Track if delegation has been setup
  USER_ADDRESS: 'userAddress',
  LAST_SYNC: 'lastSync',
  THEME: 'theme',
} as const;

// WebSocket configuration
export const WS_CONFIG = {
  reconnectDelay: 1000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
  messageTimeout: 10000,
} as const;

// UI Configuration
export const UI_CONFIG = {
  refreshInterval: 5000, // 5 seconds
  orderBookLevels: 10,
  recentTradesCount: 20,
  chartCandleCount: 100,
  maxDecimalPlaces: 6,
} as const;

// Order types
export const ORDER_TYPES = {
  MARKET: 'market',
  LIMIT: 'limit',
} as const;

// Order sides
export const ORDER_SIDES = {
  BUY: 'buy',
  SELL: 'sell',
} as const;

// Order status
export const ORDER_STATUS = {
  PENDING: 'pending',
  OPEN: 'open',
  PARTIALLY_FILLED: 'partially_filled',
  FILLED: 'filled',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired',
} as const;

// Colors (matching the web app theme)
export const COLORS = {
  // Primary colors
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#60A5FA',
  
  // Success/Error/Warning
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  
  // Background colors
  background: '#0A0E1A',
  backgroundSecondary: '#111827',
  backgroundTertiary: '#1F2937',
  
  // Surface colors
  surface: '#1F2937',
  border: '#374151',
  
  // Text colors
  text: '#F9FAFB',
  textPrimary: '#F9FAFB',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  
  // Order book colors
  buyColor: '#10B981',
  sellColor: '#EF4444',
  
  // Chart colors
  candleUp: '#10B981',
  candleDown: '#EF4444',
} as const;

// Animation durations
export const ANIMATIONS = {
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

// Error messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  TRANSACTION_FAILED: 'Transaction failed. Please try again.',
  INSUFFICIENT_BALANCE: 'Insufficient balance.',
  INVALID_ORDER: 'Invalid order parameters.',
  SESSION_EXPIRED: 'Session expired. Please reconnect.',
  WEBSOCKET_ERROR: 'Real-time connection lost. Reconnecting...',
} as const;