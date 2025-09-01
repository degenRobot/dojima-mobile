import { ponder } from "ponder:registry";
import {
  TradingBook,
  CLOBOrder,
  Trade,
  UserBalance,
  UserActivity,
  MarketStats
} from "ponder:schema";

// Helper function to get order status string
function getOrderStatus(status: number): string {
  const statuses = ["ACTIVE", "PARTIALLY_FILLED", "FILLED", "CANCELLED"];
  return statuses[status] || "UNKNOWN";
}

// Helper function to get order type string  
function getOrderType(orderType: number): string {
  return orderType === 0 ? "BUY" : "SELL";
}

// =====================
// BookCreated Event
// =====================
ponder.on("UnifiedCLOBV2:BookCreated", async ({ event, context }) => {
  // Create trading book
  await context.db.insert(TradingBook).values({
    id: event.args.bookId.toString(),
    baseToken: event.args.baseToken.toLowerCase(),
    quoteToken: event.args.quoteToken.toLowerCase(),
    name: event.args.name,
    active: true,
    volume24h: 0n,
    totalVolume: 0n,
    buyOrderCount: 0,
    sellOrderCount: 0,
    createdAt: Number(event.block.timestamp),
    updatedAt: Number(event.block.timestamp),
  });
});

// =====================
// OrderPlaced Event
// =====================
ponder.on("UnifiedCLOBV2:OrderPlaced", async ({ event, context }) => {
  const orderId = event.args.orderId.toString();
  const bookId = event.args.bookId.toString();
  const orderType = getOrderType(Number(event.args.orderType));
  
  // Create order
  await context.db.insert(CLOBOrder).values({
    id: orderId,
    trader: event.args.trader.toLowerCase(),
    bookId,
    orderType,
    price: event.args.price,
    amount: event.args.amount,
    filled: 0n,
    remaining: event.args.amount,
    status: "ACTIVE",
    timestamp: Number(event.args.timestamp),
    txHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });
  
  // Update book order count - handle case where book doesn't exist yet
  const bookUpdate = orderType === "BUY" 
    ? { buyOrderCount: 1 } 
    : { sellOrderCount: 1 };
  
  await context.db
    .insert(TradingBook)
    .values({
      id: bookId,
      baseToken: "0x0000000000000000000000000000000000000000", // Will be updated by BookCreated event
      quoteToken: "0x0000000000000000000000000000000000000000",
      name: `Book ${bookId}`,
      active: true,
      volume24h: 0n,
      totalVolume: 0n,
      buyOrderCount: orderType === "BUY" ? 1 : 0,
      sellOrderCount: orderType === "SELL" ? 1 : 0,
      createdAt: Number(event.block.timestamp),
      updatedAt: Number(event.block.timestamp),
    })
    .onConflictDoUpdate((row) => ({
      buyOrderCount: orderType === "BUY" ? row.buyOrderCount + 1 : row.buyOrderCount,
      sellOrderCount: orderType === "SELL" ? row.sellOrderCount + 1 : row.sellOrderCount,
      updatedAt: Number(event.block.timestamp),
    }));
  
  // Record user activity
  await context.db.insert(UserActivity).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    user: event.args.trader.toLowerCase(),
    activityType: "ORDER_PLACED",
    bookId,
    orderId,
    amount: event.args.amount,
    price: event.args.price,
    timestamp: Number(event.args.timestamp),
    txHash: event.transaction.hash,
  });
});

// =====================
// OrderMatched Event
// =====================
ponder.on("UnifiedCLOBV2:OrderMatched", async ({ event, context }) => {
  const buyOrderId = event.args.buyOrderId.toString();
  const sellOrderId = event.args.sellOrderId.toString();
  const bookId = event.args.bookId.toString();
  const amount = event.args.amount;
  const price = event.args.price;
  
  // Create trade record
  await context.db.insert(Trade).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    bookId,
    buyOrderId,
    sellOrderId,
    buyer: event.args.buyer.toLowerCase(),
    seller: event.args.seller.toLowerCase(),
    price,
    amount,
    buyerFee: event.args.buyerFee,
    sellerFee: event.args.sellerFee,
    timestamp: Number(event.args.timestamp),
    txHash: event.transaction.hash,
    blockNumber: Number(event.block.number),
  });
  
  // Update buy order
  await context.db
    .update(CLOBOrder, { id: buyOrderId })
    .set((row) => ({
      filled: row.filled + amount,
      remaining: row.amount - (row.filled + amount),
      status: row.amount - (row.filled + amount) === 0n ? "FILLED" : "PARTIALLY_FILLED",
    }));
  
  // Update sell order
  await context.db
    .update(CLOBOrder, { id: sellOrderId })
    .set((row) => ({
      filled: row.filled + amount,
      remaining: row.amount - (row.filled + amount),
      status: row.amount - (row.filled + amount) === 0n ? "FILLED" : "PARTIALLY_FILLED",
    }));
  
  // Update trading book stats
  const quoteVolume = (amount * price) / 10n ** 18n; // Adjust for decimals
  await context.db
    .update(TradingBook, { id: bookId })
    .set((row) => ({
      lastPrice: price,
      totalVolume: row.totalVolume + quoteVolume,
      updatedAt: Number(event.block.timestamp),
    }));
  
  // Record user activities
  await context.db.insert(UserActivity).values({
    id: `${event.transaction.hash}-${event.log.logIndex}-buyer`,
    user: event.args.buyer.toLowerCase(),
    activityType: "TRADE",
    bookId,
    orderId: buyOrderId,
    amount,
    price,
    timestamp: Number(event.args.timestamp),
    txHash: event.transaction.hash,
  });
  
  await context.db.insert(UserActivity).values({
    id: `${event.transaction.hash}-${event.log.logIndex}-seller`,
    user: event.args.seller.toLowerCase(),
    activityType: "TRADE",
    bookId,
    orderId: sellOrderId,
    amount,
    price,
    timestamp: Number(event.args.timestamp),
    txHash: event.transaction.hash,
  });
});

// =====================
// OrderCancelled Event
// =====================
ponder.on("UnifiedCLOBV2:OrderCancelled", async ({ event, context }) => {
  const orderId = event.args.orderId.toString();
  
  // Update order status - only if it exists
  try {
    const order = await context.db.find(CLOBOrder, { id: orderId });
    
    if (order) {
      await context.db
        .update(CLOBOrder, { id: orderId })
        .set({ status: "CANCELLED" });
      
      // Update book order count if book exists
      const book = await context.db.find(TradingBook, { id: order.bookId });
      if (book) {
        if (order.orderType === "BUY") {
          await context.db
            .update(TradingBook, { id: order.bookId })
            .set((row) => ({
              buyOrderCount: Math.max(0, row.buyOrderCount - 1),
              updatedAt: Number(event.block.timestamp),
            }));
        } else {
          await context.db
            .update(TradingBook, { id: order.bookId })
            .set((row) => ({
              sellOrderCount: Math.max(0, row.sellOrderCount - 1),
              updatedAt: Number(event.block.timestamp),
            }));
        }
      }
    }
  } catch (e) {
    // Order doesn't exist yet, ignore
  }
  
  // Record user activity
  await context.db.insert(UserActivity).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    user: event.args.trader.toLowerCase(),
    activityType: "ORDER_CANCELLED",
    orderId,
    timestamp: Number(event.args.timestamp),
    txHash: event.transaction.hash,
  });
});

// =====================
// Deposited Event
// =====================
ponder.on("UnifiedCLOBV2:Deposited", async ({ event, context }) => {
  const userId = event.args.user.toLowerCase();
  const token = event.args.token.toLowerCase();
  const balanceId = `${userId}-${token}`;
  
  // Update or create user balance
  await context.db
    .insert(UserBalance)
    .values({
      id: balanceId,
      user: userId,
      token,
      available: event.args.amount,
      locked: 0n,
      totalDeposited: event.args.amount,
      totalWithdrawn: 0n,
      lastUpdated: Number(event.block.timestamp),
    })
    .onConflictDoUpdate((row) => ({
      available: row.available + event.args.amount,
      totalDeposited: row.totalDeposited + event.args.amount,
      lastUpdated: Number(event.block.timestamp),
    }));
  
  // Record user activity
  await context.db.insert(UserActivity).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    user: userId,
    activityType: "DEPOSIT",
    token,
    amount: event.args.amount,
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });
});

// =====================
// Withdrawn Event
// =====================
ponder.on("UnifiedCLOBV2:Withdrawn", async ({ event, context }) => {
  const userId = event.args.user.toLowerCase();
  const token = event.args.token.toLowerCase();
  const balanceId = `${userId}-${token}`;
  
  // Update user balance
  await context.db
    .update(UserBalance, { id: balanceId })
    .set((row) => ({
      available: row.available - event.args.amount,
      totalWithdrawn: row.totalWithdrawn + event.args.amount,
      lastUpdated: Number(event.block.timestamp),
    }));
  
  // Record user activity
  await context.db.insert(UserActivity).values({
    id: `${event.transaction.hash}-${event.log.logIndex}`,
    user: userId,
    activityType: "WITHDRAW",
    token,
    amount: event.args.amount,
    timestamp: Number(event.block.timestamp),
    txHash: event.transaction.hash,
  });
});

// =====================
// PriceUpdate Event
// =====================
ponder.on("UnifiedCLOBV2:PriceUpdate", async ({ event, context }) => {
  const bookId = event.args.bookId.toString();
  
  // Update trading book with latest price
  await context.db
    .update(TradingBook, { id: bookId })
    .set({
      lastPrice: event.args.price,
      updatedAt: Number(event.args.timestamp),
    });
  
  // Update market stats for different periods
  const periods = ["1h", "24h", "7d"];
  const timestamp = Number(event.args.timestamp);
  
  for (const period of periods) {
    const statId = `${bookId}-${period}`;
    
    await context.db
      .insert(MarketStats)
      .values({
        id: statId,
        bookId,
        period,
        high: event.args.price,
        low: event.args.price,
        open: event.args.price,
        close: event.args.price,
        volume: 0n,
        trades: 0,
        timestamp,
      })
      .onConflictDoUpdate((row) => ({
        high: row.high && row.high > event.args.price ? row.high : event.args.price,
        low: row.low && row.low < event.args.price ? row.low : event.args.price,
        close: event.args.price,
        timestamp,
      }));
  }
});

// =====================
// VolumeUpdate Event
// =====================
ponder.on("UnifiedCLOBV2:VolumeUpdate", async ({ event, context }) => {
  const bookId = event.args.bookId.toString();
  
  // Update market stats with volume
  const periods = ["1h", "24h", "7d"];
  
  for (const period of periods) {
    const statId = `${bookId}-${period}`;
    
    await context.db
      .update(MarketStats, { id: statId })
      .set((row) => ({
        volume: row.volume + event.args.volume,
        trades: row.trades + 1,
        timestamp: Number(event.args.timestamp),
      }));
  }
});