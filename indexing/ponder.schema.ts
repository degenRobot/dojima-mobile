import { index, onchainTable, primaryKey, relations } from "ponder";

// ============================================
// USER & BALANCE TRACKING
// ============================================

export const account = onchainTable(
  "account",
  (t) => ({
    address: t.hex().primaryKey(),
    balance: t.bigint().notNull().default(0n), // For ERC20 tracking
    isOwner: t.boolean().notNull().default(false), // For ERC20 tracking
    firstSeenAt: t.integer().notNull(),
    lastActiveAt: t.integer().notNull(),
    totalTradesCount: t.integer().notNull().default(0),
    totalVolumeUsd: t.bigint().notNull().default(0n),
    totalFeesPaid: t.bigint().notNull().default(0n),
  })
);

export const balance = onchainTable(
  "balance",
  (t) => ({
    id: t.text().primaryKey(), // {user}-{market}-{token}
    user: t.hex().notNull(),
    market: t.hex().notNull(),
    token: t.hex().notNull(),
    available: t.bigint().notNull().default(0n),
    locked: t.bigint().notNull().default(0n),
    total: t.bigint().notNull().default(0n),
    lastUpdate: t.integer().notNull(),
  }),
  (table) => ({
    userMarketIdx: index("balance_user_market").on(table.user, table.market),
  })
);

// Deposit and withdrawal events
export const deposit = onchainTable(
  "deposit",
  (t) => ({
    id: t.text().primaryKey(),
    user: t.hex().notNull(),
    market: t.hex().notNull(),
    token: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    blockNumber: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    userIdx: index("deposit_user").on(table.user),
    marketIdx: index("deposit_market").on(table.market),
    timestampIdx: index("deposit_timestamp").on(table.timestamp),
  })
);

export const withdrawal = onchainTable(
  "withdrawal",
  (t) => ({
    id: t.text().primaryKey(),
    user: t.hex().notNull(),
    market: t.hex().notNull(),
    token: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    blockNumber: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    userIdx: index("withdrawal_user").on(table.user),
    marketIdx: index("withdrawal_market").on(table.market),
    timestampIdx: index("withdrawal_timestamp").on(table.timestamp),
  })
);

// ============================================
// USER ORDER HISTORY
// ============================================

// Complete order history (includes cancelled, filled, etc.)
export const orderHistory = onchainTable(
  "order_history",
  (t) => ({
    id: t.text().primaryKey(), // {market}-{orderId}
    market: t.hex().notNull(),
    orderId: t.bigint().notNull(),
    trader: t.hex().notNull(),
    isBuy: t.boolean().notNull(),
    orderType: t.text().notNull(), // LIMIT/MARKET
    price: t.bigint().notNull(),
    originalAmount: t.bigint().notNull(),
    filledAmount: t.bigint().notNull().default(0n),
    status: t.text().notNull(), // ACTIVE/FILLED/PARTIALLY_FILLED/CANCELLED
    createdAt: t.integer().notNull(),
    updatedAt: t.integer().notNull(),
    cancelledAt: t.integer(),
    filledAt: t.integer(),
  }),
  (table) => ({
    traderIdx: index("order_history_trader").on(table.trader, table.createdAt),
    statusIdx: index("order_history_trader_status").on(table.trader, table.status),
  })
);

// ============================================
// LIVE ORDER BOOK
// ============================================

// Active orders for order book reconstruction
export const activeOrder = onchainTable(
  "active_order",
  (t) => ({
    id: t.text().primaryKey(), // {market}-{orderId}
    market: t.hex().notNull(),
    orderId: t.bigint().notNull(),
    trader: t.hex().notNull(),
    isBuy: t.boolean().notNull(),
    price: t.bigint().notNull(),
    originalAmount: t.bigint().notNull(),
    remainingAmount: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (table) => ({
    // Composite index for efficient order book queries
    marketSidePriceIdx: index("active_order_market_side_price").on(
      table.market,
      table.isBuy,
      table.price
    ),
    orderIdIdx: index("active_order_id").on(table.market, table.orderId),
  })
);

// Price level aggregation for efficient order book display
export const priceLevel = onchainTable(
  "price_level",
  (t) => ({
    id: t.text().primaryKey(), // {market}-{price}-{isBuy}
    market: t.hex().notNull(),
    price: t.bigint().notNull(),
    isBuy: t.boolean().notNull(),
    totalAmount: t.bigint().notNull(),
    orderCount: t.integer().notNull(),
    lastUpdate: t.integer().notNull(),
  }),
  (table) => ({
    marketSideIdx: index("price_level_market_side").on(table.market, table.isBuy),
  })
);

// ============================================
// TRADES & VOLUME
// ============================================

// Granular trade data
export const trade = onchainTable(
  "trade",
  (t) => ({
    id: t.text().primaryKey(),
    market: t.hex().notNull(),
    buyOrderId: t.bigint().notNull(),
    sellOrderId: t.bigint().notNull(),
    buyer: t.hex().notNull(),
    seller: t.hex().notNull(),
    maker: t.hex().notNull(),
    taker: t.hex().notNull(),
    price: t.bigint().notNull(),
    amount: t.bigint().notNull(),
    quoteVolume: t.bigint().notNull(), // price * amount / 1e18
    makerFee: t.bigint().notNull(),
    takerFee: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    timestampMinute: t.integer().notNull(), // Minute-precision timestamp for candle aggregation
    blockNumber: t.integer().notNull(),
    transactionHash: t.hex().notNull(),
  }),
  (table) => ({
    marketTimestampIdx: index("trade_market_timestamp").on(table.market, table.timestamp),
    marketMinuteIdx: index("trade_market_minute").on(table.market, table.timestampMinute),
    buyerIdx: index("trade_buyer").on(table.buyer),
    sellerIdx: index("trade_seller").on(table.seller),
  })
);

// User's trade history
export const userTrade = onchainTable(
  "user_trade",
  (t) => ({
    id: t.text().primaryKey(),
    trader: t.hex().notNull(),
    market: t.hex().notNull(),
    orderId: t.bigint().notNull(),
    side: t.text().notNull(), // BUY/SELL
    role: t.text().notNull(), // MAKER/TAKER
    price: t.bigint().notNull(),
    amount: t.bigint().notNull(),
    quoteAmount: t.bigint().notNull(),
    fee: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
  }),
  (table) => ({
    traderMarketIdx: index("user_trade_trader_market").on(
      table.trader,
      table.market,
      table.timestamp
    ),
  })
);

// ============================================
// MARKET STATS
// ============================================

// 24h rolling volume (updated on each trade)
export const market24hStats = onchainTable(
  "market_24h_stats",
  (t) => ({
    market: t.hex().primaryKey(),
    volume24h: t.bigint().notNull(),
    trades24h: t.integer().notNull(),
    high24h: t.bigint().notNull(),
    low24h: t.bigint().notNull(),
    lastUpdate: t.integer().notNull(),
  })
);

// Latest price per market
export const marketPrice = onchainTable(
  "market_price",
  (t) => ({
    market: t.hex().primaryKey(),
    lastPrice: t.bigint().notNull(),
    lastTradeId: t.text().notNull(),
    lastTradeTimestamp: t.integer().notNull(),
    priceChange24h: t.bigint(), // Percentage * 100
    priceChange1h: t.bigint(),
  })
);

// Hourly volume aggregation
export const hourlyVolume = onchainTable(
  "hourly_volume",
  (t) => ({
    id: t.text().primaryKey(), // {market}-{hourTimestamp}
    market: t.hex().notNull(),
    hourTimestamp: t.integer().notNull(), // Unix timestamp rounded to hour
    volume: t.bigint().notNull(),
    trades: t.integer().notNull(),
    high: t.bigint().notNull(),
    low: t.bigint().notNull(),
    open: t.bigint().notNull(),
    close: t.bigint().notNull(),
  }),
  (table) => ({
    marketHourIdx: index("hourly_volume_market_hour").on(table.market, table.hourTimestamp),
  })
);

// ============================================
// MARKETS & PAIRS
// ============================================

export const market = onchainTable(
  "market",
  (t) => ({
    address: t.hex().primaryKey(),
    pairId: t.bigint().notNull(),
    type: t.text().notNull(), // SPOT/PERP
    baseToken: t.hex().notNull(),
    quoteToken: t.hex().notNull(),
    name: t.text().notNull(), // e.g., "ETH-USDC"
    deployedAt: t.integer().notNull(),
    isActive: t.boolean().notNull().default(true),
  }),
  (table) => ({
    typeIdx: index("market_type_index").on(table.type),
    activeIdx: index("market_active_index").on(table.isActive),
  })
);

// Price history for charts
export const priceCandle = onchainTable(
  "price_candle",
  (t) => ({
    id: t.text().primaryKey(), // {market}-{interval}-{timestamp}
    market: t.hex().notNull(),
    interval: t.text().notNull(), // 1m, 5m, 15m, 1h, 4h, 1d
    timestamp: t.integer().notNull(),
    open: t.bigint().notNull(),
    high: t.bigint().notNull(),
    low: t.bigint().notNull(),
    close: t.bigint().notNull(),
    volume: t.bigint().notNull(),
    trades: t.integer().notNull(),
  }),
  (table) => ({
    marketIntervalIdx: index("price_candle_market_interval").on(
      table.market,
      table.interval,
      table.timestamp
    ),
  })
);

// ============================================
// ERC20 TRACKING (kept for compatibility)
// ============================================

export const transferEvent = onchainTable(
  "transfer_event",
  (t) => ({
    id: t.text().primaryKey(),
    amount: t.bigint().notNull(),
    timestamp: t.integer().notNull(),
    from: t.hex().notNull(),
    to: t.hex().notNull(),
  }),
  (table) => ({
    fromIdx: index("from_index").on(table.from),
  }),
);

export const allowance = onchainTable(
  "allowance",
  (t) => ({
    owner: t.hex(),
    spender: t.hex(),
    amount: t.bigint().notNull(),
  }),
  (table) => ({
    pk: primaryKey({ columns: [table.owner, table.spender] }),
  }),
);

export const approvalEvent = onchainTable("approval_event", (t) => ({
  id: t.text().primaryKey(),
  amount: t.bigint().notNull(),
  timestamp: t.integer().notNull(),
  owner: t.hex().notNull(),
  spender: t.hex().notNull(),
}));

// ============================================
// RELATIONS
// ============================================

export const accountRelations = relations(account, ({ many }) => ({
  transferFromEvents: many(transferEvent, { relationName: "from_account" }),
  transferToEvents: many(transferEvent, { relationName: "to_account" }),
  activeOrders: many(activeOrder),
  orderHistory: many(orderHistory),
  userTrades: many(userTrade),
  balances: many(balance),
  deposits: many(deposit),
  withdrawals: many(withdrawal),
}));

export const transferEventRelations = relations(transferEvent, ({ one }) => ({
  fromAccount: one(account, {
    relationName: "from_account",
    fields: [transferEvent.from],
    references: [account.address],
  }),
  toAccount: one(account, {
    relationName: "to_account",
    fields: [transferEvent.to],
    references: [account.address],
  }),
}));

export const activeOrderRelations = relations(activeOrder, ({ one }) => ({
  trader: one(account, {
    fields: [activeOrder.trader],
    references: [account.address],
  }),
  market: one(market, {
    fields: [activeOrder.market],
    references: [market.address],
  }),
}));

export const orderHistoryRelations = relations(orderHistory, ({ one }) => ({
  trader: one(account, {
    fields: [orderHistory.trader],
    references: [account.address],
  }),
  market: one(market, {
    fields: [orderHistory.market],
    references: [market.address],
  }),
}));

export const userTradeRelations = relations(userTrade, ({ one }) => ({
  trader: one(account, {
    fields: [userTrade.trader],
    references: [account.address],
  }),
  market: one(market, {
    fields: [userTrade.market],
    references: [market.address],
  }),
}));

export const balanceRelations = relations(balance, ({ one }) => ({
  user: one(account, {
    fields: [balance.user],
    references: [account.address],
  }),
  market: one(market, {
    fields: [balance.market],
    references: [market.address],
  }),
}));

export const depositRelations = relations(deposit, ({ one }) => ({
  user: one(account, {
    fields: [deposit.user],
    references: [account.address],
  }),
  market: one(market, {
    fields: [deposit.market],
    references: [market.address],
  }),
}));

export const withdrawalRelations = relations(withdrawal, ({ one }) => ({
  user: one(account, {
    fields: [withdrawal.user],
    references: [account.address],
  }),
  market: one(market, {
    fields: [withdrawal.market],
    references: [market.address],
  }),
}));

export const marketRelations = relations(market, ({ many }) => ({
  activeOrders: many(activeOrder),
  trades: many(trade),
  deposits: many(deposit),
  withdrawals: many(withdrawal),
  hourlyVolumes: many(hourlyVolume),
  priceCandles: many(priceCandle),
}));

export const priceCandleRelations = relations(priceCandle, ({ one }) => ({
  market: one(market, {
    fields: [priceCandle.market],
    references: [market.address],
  }),
}));

export const tradeRelations = relations(trade, ({ one }) => ({
  market: one(market, {
    fields: [trade.market],
    references: [market.address],
  }),
  buyer: one(account, {
    fields: [trade.buyer],
    references: [account.address],
  }),
  seller: one(account, {
    fields: [trade.seller],
    references: [account.address],
  }),
}));

export const hourlyVolumeRelations = relations(hourlyVolume, ({ one }) => ({
  market: one(market, {
    fields: [hourlyVolume.market],
    references: [market.address],
  }),
}));

export const market24hStatsRelations = relations(market24hStats, ({ one }) => ({
  market: one(market, {
    fields: [market24hStats.market],
    references: [market.address],
  }),
}));

export const marketPriceRelations = relations(marketPrice, ({ one }) => ({
  market: one(market, {
    fields: [marketPrice.market],
    references: [market.address],
  }),
}));

export const priceLevelRelations = relations(priceLevel, ({ one }) => ({
  market: one(market, {
    fields: [priceLevel.market],
    references: [market.address],
  }),
}));